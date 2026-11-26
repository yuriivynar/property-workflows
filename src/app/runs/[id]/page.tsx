import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import {
  canChangeAnswer,
  errorParam,
  formatYourTasks,
  groupBySection,
  messageForError,
  requiredLabel,
  staffLabel,
  vendorRunNotice,
} from "@/lib/runs/domain";
import { signedInViewer } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { templateVersionLabel } from "@/lib/templates/version";
import { MarkDoneButton } from "./mark-done-button";
import { fieldOptions, RunDetailsCard, RunSection, type RunField } from "./run-parts";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { BackLink } from "@/components/ui/back-link";
import { RunDocuments } from "./_document/run-documents";

// Сторінка запуску: прогрес «N of M done», задачі за розділами з виконавцем, позначкою обов'язковості й статусом
// (AC-TASK-05, AC-TASK-08; робоче рішення до solomchaak/property-workflows-spec#11), кнопка позначки — лише там, де
// користувач може позначити (AC-TASK-01, AC-TASK-02, AC-TASK-07). Чужий запуск RLS не повертає — «Run not found»
// (AC-TASK-06; робоче рішення до solomchaak/property-workflows-spec#4).
// Розбір документа чекає на безкоштовну модель до 45 с і ще раз до 45 с на повторі: функція не має обриватися раніше
// за таймаут моделі (Server Action «Propose values» успадковує ліміт сторінки; Vercel Hobby з Fluid — до 300 с).
export const maxDuration = 120;

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

  const { sections, tasks: allTasks, fields, names, versionNumber } = await loadRun(supabase, runId);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const sectionName = new Map(sections.map((section) => [section.id, section.name]));
  const optionsOf = (field: RunField) => fieldOptions(field, allTasks, sectionName);
  // Відповідь змінюють лише менеджер запуску й адміністратор (AC-LOGIC-05); лише їм — меню й рядки-«привиди».
  const canAnswer = canChangeAnswer({ userId: viewer.userId, role: viewer.role, runManagerId });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumb items={[{ href: "/runs", label: LABELS.runsTitle }]} current={run.case_name} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]" data-testid="case-name">
          {run.case_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {run.template_name}
          {versionNumber ? <span data-testid="template-version"> · {templateVersionLabel(versionNumber)}</span> : null}
        </p>
      </div>
      {/* Від lg — дві колонки: розділи з задачами ліворуч, закріплена картка деталей праворуч (ADR 0008, ADR 0012). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <RunDetailsCard
          {...detailsOf(run, versionNumber)}
          runId={runId}
          manager={names.get(runManagerId) ?? "—"}
          fields={fields}
          canAnswer={canAnswer}
          optionsOf={optionsOf}
        />

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {sections.map((section) => (
            <RunSection
              key={section.id}
              runId={runId}
              name={section.name}
              tasks={allTasks.filter((task) => task.section_id === section.id)}
              allTasks={allTasks}
              fieldById={fieldById}
              names={names}
              viewer={viewer}
              runManagerId={runManagerId}
              canAnswer={canAnswer}
              optionsOf={optionsOf}
            />
          ))}

          <RunDocuments supabase={supabase} runId={runId} viewer={viewer} runManagerId={runManagerId} names={names} />
        </div>
      </div>
    </main>
  );
}

// Номер версії — у runs (копія на момент запуску), а не у view run_overview (AC-EDITOR-06).
async function loadRun(supabase: Awaited<ReturnType<typeof createClient>>, runId: string) {
  const [{ data: sections }, { data: tasks }, { data: fields }, { data: staff }, { data: version }] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", runId).order("position"),
    supabase
      .from("run_tasks")
      .select("id, section_id, name, is_required, position, assignee_id, status, is_shown, show_when_field_id, show_when_value")
      .eq("run_id", runId)
      .order("position"),
    supabase.from("run_fields").select("id, name, options, position, answer").eq("run_id", runId).order("position"),
    supabase.rpc("staff_directory"),
    supabase.from("runs").select("template_version").eq("id", runId).maybeSingle(),
  ]);
  return {
    sections: sections ?? [],
    tasks: tasks ?? [],
    fields: fields ?? [],
    names: new Map((staff ?? []).map((person) => [person.id, staffLabel(person)])),
    versionNumber: version?.template_version ?? null,
  };
}

/** Прогрес, статус і «шаблон · vN» для картки деталей. */
function detailsOf(
  run: { done_count: number | null; total_count: number | null; status: string | null; template_name: string | null },
  versionNumber: number | null,
) {
  return {
    done: run.done_count ?? 0,
    total: run.total_count ?? 0,
    status: run.status ?? "",
    template: `${run.template_name ?? ""}${versionNumber ? ` · v${versionNumber}` : ""}`,
  };
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
      <BackLink href="/runs">{LABELS.backToRuns}</BackLink>
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
        <BackLink href="/runs">{LABELS.backToRuns}</BackLink>
      </main>
    );
  }
  const run = runs?.find((candidate) => candidate.id === id);
  if (!run || !tasks?.length) return <RunNotFound message={vendorRunNotice(false, errorCode)} />;
  const message = vendorRunNotice(true, errorCode);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumb items={[{ href: "/runs", label: LABELS.runsTitle }]} current={run.case_name} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]" data-testid="case-name">
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
                    <span className="min-w-0 [overflow-wrap:anywhere]">
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
    </main>
  );
}
