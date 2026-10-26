import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import {
  canMarkTask,
  formatProgress,
  messageForError,
  needsConfirmation,
  requiredLabel,
  staffLabel,
} from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";
import { templateVersionLabel } from "@/lib/templates/version";
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-semibold">{MESSAGES.runNotFound}</h1>
        {message ? (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <TextLink href="/runs" className="w-fit text-sm">
          {LABELS.backToRuns}
        </TextLink>
      </main>
    );
  }
  const runId = run.id;
  const runManagerId = run.run_manager_id;

  // Номер версії — у runs (копія на момент запуску), а не у view run_overview (AC-EDITOR-06).
  const [{ data: sections }, { data: tasks }, { data: staff }, { data: version }] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", runId).order("position"),
    supabase
      .from("run_tasks")
      .select("id, section_id, name, is_required, position, assignee_id, status")
      .eq("run_id", runId)
      .order("position"),
    supabase.rpc("staff_directory"),
    supabase.from("runs").select("template_version").eq("id", runId).maybeSingle(),
  ]);
  const names = new Map((staff ?? []).map((person) => [person.id, staffLabel(person)]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" data-testid="case-name">
          {run.case_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {run.template_name}
          {version?.template_version ? (
            <span data-testid="template-version"> · {templateVersionLabel(version.template_version)}</span>
          ) : null}
        </p>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{LABELS.runManager}</dt>
        <dd data-testid="run-manager">{names.get(runManagerId) ?? "—"}</dd>
        <dt className="text-muted-foreground">{LABELS.status}</dt>
        <dd data-testid="run-status">
          <StatusBadge status={run.status ?? ""} />
        </dd>
        <dt className="text-muted-foreground">{LABELS.progress}</dt>
        <dd className="tabular-nums" data-testid="run-progress">
          {formatProgress(run.done_count ?? 0, run.total_count ?? 0)}
        </dd>
      </dl>

      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {(sections ?? []).map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{section.name}</h2>
          <Card className="gap-0 py-0">
            <ul className="flex flex-col divide-y divide-border">
            {(tasks ?? [])
              .filter((task) => task.section_id === section.id)
              .map((task) => (
                <li key={task.id} data-testid="run-task" className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {task.name}{" "}
                      <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-4 text-muted-foreground">
                      <span>{names.get(task.assignee_id) ?? "—"}</span>
                      <span data-testid="task-status">
                        <StatusBadge status={task.status} />
                      </span>
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
          </Card>
        </section>
      ))}

      <TextLink href="/runs" className="w-fit text-sm">
        {LABELS.backToRuns}
      </TextLink>
    </main>
  );
}
