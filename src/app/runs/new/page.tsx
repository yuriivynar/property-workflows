import Link from "next/link";
import { redirect } from "next/navigation";
import { messageForError, requiredLabel, staffLabel } from "@/lib/runs/domain";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "../submit-button";
import { launchRun } from "./actions";

// Запуск шаблону: спершу вибір шаблону, потім назва випадку і виконавець кожної задачі (за розділами).
// За замовчуванням виконавець — менеджер запуску (AC-RUN-04, AC-RUN-08, AC-RUN-09).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const { template, error } = await searchParams;
  const templateId = typeof template === "string" ? template : undefined;
  const message = typeof error === "string" ? messageForError(error) : undefined;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  const { data: templates } = await supabase.from("templates").select("id, name").order("name");
  const selected = templates?.find((t) => t.id === templateId);

  const [sectionsResult, tasksResult, staffResult] = selected
    ? await Promise.all([
        supabase
          .from("template_sections")
          .select("id, name, position")
          .eq("template_id", selected.id)
          .order("position"),
        supabase
          .from("template_tasks")
          .select("id, section_id, name, is_required, position")
          .eq("template_id", selected.id)
          .order("position"),
        supabase.rpc("staff_directory"),
      ])
    : [null, null, null];
  const sections = sectionsResult?.data ?? [];
  const tasks = tasksResult?.data ?? [];
  const colleagues = (staffResult?.data ?? []).filter((person) => person.id !== claims.sub);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">{LABELS.launchTemplate}</h1>

      <form action="/runs/new" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {LABELS.template}
          <select
            name="template"
            defaultValue={selected?.id ?? ""}
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              {MESSAGES.templateNotFound}
            </option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          {LABELS.choose}
        </button>
      </form>

      {!selected && message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}

      {selected ? (
        <form action={launchRun} className="flex flex-col gap-5">
          <input type="hidden" name="template_id" value={selected.id} />
          <label className="flex flex-col gap-1 text-sm">
            {LABELS.caseName}
            <input
              name="case_name"
              type="text"
              placeholder={LABELS.caseNamePlaceholder}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          {sections.map((section) => (
            <fieldset key={section.id} className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <legend className="px-1 text-sm font-medium">{section.name}</legend>
              {tasks
                .filter((task) => task.section_id === section.id)
                .map((task) => (
                  <label key={task.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {task.name} <span className="text-zinc-500">({requiredLabel(task.is_required)})</span>
                    </span>
                    <select
                      name={`assignee:${task.id}`}
                      defaultValue=""
                      aria-label={LABELS.assigneeOf(task.name)}
                      className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">{LABELS.meAsRunManager}</option>
                      {colleagues.map((person) => (
                        <option key={person.id} value={person.id}>
                          {staffLabel(person)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </fieldset>
          ))}

          {message ? (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          ) : null}
          <div>
            <SubmitButton label={LABELS.launch} pendingLabel={LABELS.launching} />
          </div>
        </form>
      ) : null}

      <Link href="/runs" className="text-sm underline">
        {LABELS.backToRuns}
      </Link>
    </main>
  );
}
