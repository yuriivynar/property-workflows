import Link from "next/link";
import { redirect } from "next/navigation";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import {
  canMarkTask,
  formatProgress,
  messageForError,
  needsConfirmation,
  requiredLabel,
  runStatusLabel,
  staffLabel,
  taskStatusLabel,
} from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";
import { MarkDoneButton } from "./mark-done-button";

// Сторінка запуску: прогрес «N of M done», задачі за розділами з виконавцем, позначкою обов'язковості й статусом
// (AC-TASK-05, AC-TASK-08; робоче рішення до solomchaak/property-workflows-spec#11), кнопка позначки — лише там, де
// користувач може позначити (AC-TASK-01, AC-TASK-02, AC-TASK-07). Чужий запуск RLS не повертає — «Run not found»
// (AC-TASK-06; робоче рішення до solomchaak/property-workflows-spec#4).
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const message = typeof error === "string" ? messageForError(error) : undefined;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  const [{ data: run }, { data: profile }] = await Promise.all([
    supabase
      .from("run_overview")
      .select("id, case_name, template_name, status, run_manager_id, done_count, total_count")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", claims.sub).maybeSingle(),
  ]);

  if (!run?.id || !run.run_manager_id) {
    // Той, хто не бачить запуску, теж отримує текст AC-TASK-03, якщо надіслав позначку попри інтерфейс
    // (стара сторінка, прямий запит): база відповідає NOT_ALLOWED і для чужої, і для відсутньої задачі, тож
    // повідомлення не підказує, що запуск існує.
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">{MESSAGES.runNotFound}</h1>
        {message ? (
          <p role="alert" className="text-sm text-red-600">
            {message}
          </p>
        ) : null}
        <Link href="/runs" className="text-sm underline">
          {LABELS.backToRuns}
        </Link>
      </main>
    );
  }
  const runId = run.id;
  const runManagerId = run.run_manager_id;

  const [{ data: sections }, { data: tasks }, { data: staff }] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", runId).order("position"),
    supabase
      .from("run_tasks")
      .select("id, section_id, name, is_required, position, assignee_id, status")
      .eq("run_id", runId)
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
        <dt className="text-zinc-500">{LABELS.runManager}</dt>
        <dd data-testid="run-manager">{names.get(runManagerId) ?? "—"}</dd>
        <dt className="text-zinc-500">{LABELS.status}</dt>
        <dd data-testid="run-status">{runStatusLabel(run.status ?? "")}</dd>
        <dt className="text-zinc-500">{LABELS.progress}</dt>
        <dd data-testid="run-progress">{formatProgress(run.done_count ?? 0, run.total_count ?? 0)}</dd>
      </dl>

      {message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}

      {(sections ?? []).map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{section.name}</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {(tasks ?? [])
              .filter((task) => task.section_id === section.id)
              .map((task) => (
                <li key={task.id} data-testid="run-task" className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {task.name} <span className="text-zinc-500">({requiredLabel(task.is_required)})</span>
                    </span>
                    <span className="flex flex-wrap gap-x-4 text-zinc-600 dark:text-zinc-400">
                      <span>{names.get(task.assignee_id) ?? "—"}</span>
                      <span data-testid="task-status">{taskStatusLabel(task.status)}</span>
                    </span>
                  </div>
                  {canMarkTask({
                    userId: claims.sub,
                    role: profile?.role,
                    runManagerId,
                    assigneeId: task.assignee_id,
                    status: task.status,
                  }) ? (
                    <MarkDoneButton
                      runId={runId}
                      taskId={task.id}
                      taskName={task.name}
                      confirm={needsConfirmation(tasks ?? [], task.id)}
                    />
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Link href="/runs" className="text-sm underline">
        {LABELS.backToRuns}
      </Link>
    </main>
  );
}
