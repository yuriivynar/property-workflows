import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import {
  canMarkTask,
  errorParam,
  formatProgress,
  formatYourTasks,
  groupBySection,
  messageForError,
  needsConfirmation,
  requiredLabel,
  staffLabel,
  vendorRunNotice,
} from "@/lib/runs/domain";
import { signedInViewer } from "@/lib/auth/require-role";
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
  const errorCode = errorParam(error);

  const supabase = await createClient();
  const viewer = await signedInViewer(supabase);
  if (!viewer) {
    redirect("/login");
  }

  if (viewer.role === "vendor") return <VendorRun id={id} errorCode={errorCode} />;
  const message = errorCode ? messageForError(errorCode) : undefined;

  const { data: run } = await supabase
    .from("run_overview")
    .select("id, case_name, template_name, status, run_manager_id, done_count, total_count")
    .eq("id", id)
    .maybeSingle();

  if (!run?.id || !run.run_manager_id) {
    // Той, хто не бачить запуску, теж отримує текст AC-TASK-03, якщо надіслав позначку попри інтерфейс
    // (стара сторінка, прямий запит): база відповідає NOT_ALLOWED і для чужої, і для відсутньої задачі, тож
    // повідомлення не підказує, що запуск існує.
    return <RunNotFound message={message} />;
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
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
      <Card className="gap-0 py-0">
        <dl className="grid divide-y divide-border text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col gap-1.5 px-4 py-3.5">
            <dt className="text-muted-foreground">{LABELS.runManager}</dt>
            <dd className="font-medium break-all" data-testid="run-manager">
              {names.get(runManagerId) ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5 px-4 py-3.5">
            <dt className="text-muted-foreground">{LABELS.status}</dt>
            <dd data-testid="run-status">
              <StatusBadge status={run.status ?? ""} />
            </dd>
          </div>
          <div className="flex flex-col gap-1.5 px-4 py-3.5">
            <dt className="text-muted-foreground">{LABELS.progress}</dt>
            <dd className="flex items-center gap-3 tabular-nums" data-testid="run-progress">
              <ProgressBar done={run.done_count ?? 0} total={run.total_count ?? 0} />
              <span className="font-medium">{formatProgress(run.done_count ?? 0, run.total_count ?? 0)}</span>
            </dd>
          </div>
        </dl>
      </Card>

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
                <li
                  key={task.id}
                  data-testid="run-task"
                  className="flex flex-col gap-2.5 px-4 py-3.5 text-sm transition-colors hover:bg-glow max-sm:[&_[data-slot=button]]:w-full max-sm:[&_form]:w-full"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {task.name}{" "}
                      <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
                      <span>{names.get(task.assignee_id) ?? "—"}</span>
                      <span data-testid="task-status">
                        <StatusBadge status={task.status} />
                      </span>
                    </span>
                  </div>
                  {canMarkTask({
                    userId: viewer.userId,
                    role: viewer.role,
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

function RunNotFound({ message }: { message?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
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

/**
 * Запуск очима вендора: назва випадку, «Your tasks: N of K done» і рівно його задачі за розділами — назва, розділ,
 * «required» / «optional», статус; без чужих задач, email інших користувачів, менеджера запуску, назви й версії шаблону
 * та прогресу всього запуску (AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-11; рішення PM solomchaak/property-workflows-spec#41). Запуск без його
 * задач — лише «Run not found», без тексту відмови позначки (AC-VENDOR-06, AC-VENDOR-15); на своєму запуску відмова
 * позначки чужої задачі — текст AC-TASK-03 (AC-VENDOR-07). Дані — лише з функцій
 * бази vendor_runs і vendor_run_tasks; позначка останньої обов'язкової задачі просить підтвердження («Припущення» PM).
 */
async function VendorRun({ id, errorCode }: { id: string; errorCode?: string }) {
  const supabase = await createClient();
  const [{ data: runs, error: runsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.rpc("vendor_runs"),
    supabase.rpc("vendor_run_tasks", { p_run_id: id }),
  ]);
  // Збій бази — не «Run not found»: вендор не повинен вирішити, що його задачі зникли.
  if (runsError || tasksError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Alert variant="destructive">
          <AlertDescription>
            <h1 className="text-base font-semibold">{MESSAGES.unexpected}</h1>
          </AlertDescription>
        </Alert>
        <TextLink href="/runs" className="w-fit text-sm">
          {LABELS.backToRuns}
        </TextLink>
      </main>
    );
  }
  const run = runs?.find((candidate) => candidate.id === id);
  if (!run || !tasks?.length) return <RunNotFound message={vendorRunNotice(false, errorCode)} />;
  const message = vendorRunNotice(true, errorCode);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" data-testid="case-name">
          {run.case_name}
        </h1>
        <p className="text-sm tabular-nums text-muted-foreground" data-testid="your-tasks">
          {formatYourTasks(run.my_done, run.my_total)}
        </p>
      </div>

      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {groupBySection(tasks).map((section) => (
        <section key={section.position} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{section.name}</h2>
          <Card className="gap-0 py-0">
            <ul className="flex flex-col divide-y divide-border">
              {section.tasks.map((task) => (
                <li
                  key={task.id}
                  data-testid="run-task"
                  className="flex flex-col gap-2.5 px-4 py-3.5 text-sm transition-colors hover:bg-glow max-sm:[&_[data-slot=button]]:w-full max-sm:[&_form]:w-full"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {task.name} <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                    </span>
                    <span data-testid="task-status">
                      <StatusBadge status={task.status} />
                    </span>
                  </div>
                  {task.status === "to_do" ? (
                    <MarkDoneButton runId={id} taskId={task.id} taskName={task.name} confirm={task.needs_confirmation} />
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
