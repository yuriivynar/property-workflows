import Link from "next/link";
import { redirect } from "next/navigation";
import { MESSAGES } from "@/lib/runs/messages";
import { requiredLabel, runStatusLabel, staffLabel, taskStatusLabel } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Сторінка запуску: задачі за розділами з виконавцем, позначкою обов'язковості й статусом.
// Чужий запуск RLS не повертає — показуємо «Run not found» (робоче рішення до відповіді на
// solomchaak/property-workflows-spec#4). Позначка задач і прогрес — задачі 2–3 плану impl-workflow-runs.
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, run_manager_id")
    .eq("id", id)
    .maybeSingle();

  if (!run) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">{MESSAGES.runNotFound}</h1>
        <Link href="/runs" className="text-sm underline">
          Back to runs
        </Link>
      </main>
    );
  }

  const [{ data: sections }, { data: tasks }, { data: staff }] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", run.id).order("position"),
    supabase
      .from("run_tasks")
      .select("id, section_id, name, is_required, position, assignee_id, status")
      .eq("run_id", run.id)
      .order("position"),
    supabase.rpc("staff_directory"),
  ]);
  const names = new Map((staff ?? []).map((person) => [person.id, staffLabel(person)]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" data-testid="case-name">
          {run.case_name}
        </h1>
        <p className="text-sm text-zinc-500">{run.template_name}</p>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Run manager</dt>
        <dd data-testid="run-manager">{names.get(run.run_manager_id) ?? "—"}</dd>
        <dt className="text-zinc-500">Status</dt>
        <dd data-testid="run-status">{runStatusLabel(run.status)}</dd>
      </dl>

      {(sections ?? []).map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{section.name}</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {(tasks ?? [])
              .filter((task) => task.section_id === section.id)
              .map((task) => (
                <li key={task.id} data-testid="run-task" className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {task.name} <span className="text-zinc-500">({requiredLabel(task.is_required)})</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-zinc-600 dark:text-zinc-400">
                    <span>{names.get(task.assignee_id) ?? "—"}</span>
                    <span data-testid="task-status">{taskStatusLabel(task.status)}</span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Link href="/runs" className="text-sm underline">
        Back to runs
      </Link>
    </main>
  );
}
