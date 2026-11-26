import { Fragment } from "react";
import { GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatusBadge } from "@/components/ui/status-badge";
import { LABELS } from "@/lib/runs/messages";
import { answerLabel, canMarkTask, formatProgress, needsConfirmation, requiredLabel } from "@/lib/runs/domain";
import { TaskItem } from "./task-item";
import { AnswerDot, UrgencyMenu, type FieldOption } from "./urgency-menu";

// Частини сторінки запуску (UI v3, ADR 0012): картка деталей і розділ із задачами. Дані готує page.tsx.

export interface RunTask {
  id: string;
  section_id: string;
  name: string;
  is_required: boolean;
  assignee_id: string;
  status: string;
  is_shown: boolean;
  show_when_field_id: string | null;
  show_when_value: string | null;
}

export interface RunField {
  id: string;
  name: string;
  options: string[];
  answer: string | null;
}

interface Viewer {
  userId: string;
  role: string | null;
}

/** Відповіді поля з рядком ефекту: які задачі з'являються з цією відповіддю (полотно UI v3). */
export function fieldOptions(field: RunField, tasks: readonly RunTask[], sectionName: Map<string, string>): FieldOption[] {
  return field.options.map((value) => {
    const added = tasks.filter((task) => task.show_when_field_id === field.id && task.show_when_value === value);
    const effect = added.length
      ? added.map((task) => LABELS.addsTaskTo(task.name, sectionName.get(task.section_id) ?? "")).join("; ")
      : LABELS.noExtraTasks;
    return { value, effect };
  });
}

function FieldValue({ field, runId, canAnswer, options }: { field: RunField; runId: string; canAnswer: boolean; options: FieldOption[] }) {
  if (canAnswer) {
    return <UrgencyMenu runId={runId} fieldId={field.id} fieldName={field.name} answer={field.answer} options={options} />;
  }
  return (
    <span className="flex items-center gap-2 font-medium" data-testid="field-answer">
      <AnswerDot index={field.answer ? field.options.indexOf(field.answer) : null} />
      {field.answer ? answerLabel(field.answer) : LABELS.noAnswer}
    </span>
  );
}

/** Картка деталей: кільце й «N of M done», статус, менеджер запуску, шаблон, поля запуску (AC-TASK-05, AC-LOGIC-01). */
export function RunDetailsCard(props: {
  runId: string;
  done: number;
  total: number;
  status: string;
  manager: string;
  template: string;
  fields: readonly RunField[];
  canAnswer: boolean;
  optionsOf: (field: RunField) => FieldOption[];
}) {
  return (
    <Card className="gap-0 py-0 lg:sticky lg:top-6 lg:order-2" aria-label={LABELS.runDetails}>
      <div className="flex items-center gap-4 px-4 py-4">
        <ProgressRing done={props.done} total={props.total} />
        <div className="flex flex-col items-start gap-1.5">
          <span className="text-xl font-semibold tabular-nums" data-testid="run-progress">
            {formatProgress(props.done, props.total)}
          </span>
          <span data-testid="run-status">
            <StatusBadge status={props.status} />
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-border px-4 py-4 text-sm">
        <dt className="text-muted-foreground">{LABELS.runManager}</dt>
        <dd className="font-medium break-all" data-testid="run-manager">
          {props.manager}
        </dd>
        <dt className="text-muted-foreground">{LABELS.template}</dt>
        <dd className="font-medium [overflow-wrap:anywhere]">{props.template}</dd>
        {props.fields.map((field) => (
          <Fragment key={field.id}>
            <dt className="text-muted-foreground">{field.name}</dt>
            <dd data-testid="run-field">
              <FieldValue field={field} runId={props.runId} canAnswer={props.canAnswer} options={props.optionsOf(field)} />
            </dd>
          </Fragment>
        ))}
      </dl>
    </Card>
  );
}

function TaskRow(props: {
  runId: string;
  task: RunTask;
  allTasks: readonly RunTask[];
  field: RunField | undefined;
  assignee: string;
  viewer: Viewer;
  runManagerId: string;
}) {
  const { task, field, viewer } = props;
  const canMark = canMarkTask({
    userId: viewer.userId,
    role: viewer.role,
    runManagerId: props.runManagerId,
    assigneeId: task.assignee_id,
    status: task.status,
  });
  return (
    <TaskItem
      runId={props.runId}
      taskId={task.id}
      name={task.name}
      requiredText={requiredLabel(task.is_required)}
      conditionText={field && task.show_when_value ? LABELS.becauseAnswer(field.name, answerLabel(task.show_when_value)) : undefined}
      assignee={props.assignee}
      status={task.status}
      canMark={canMark}
      confirm={needsConfirmation([...props.allTasks], task.id)}
    />
  );
}

/** Прихована умовою задача — пунктирний рядок-«привид» з «Set Urgency» (варіант «detail», рішення власника). */
function HiddenTaskRow({ runId, task, field, options }: { runId: string; task: RunTask; field: RunField; options: FieldOption[] }) {
  return (
    <li
      data-testid="hidden-task"
      className="flex flex-col gap-2.5 border-t border-dashed border-input bg-muted px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex min-w-0 items-start gap-3">
        <GitBranch aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5 text-muted-foreground">
          <span className="[overflow-wrap:anywhere]">{task.name}</span>
          <span>{LABELS.appearsOnlyWhen(field.name, answerLabel(task.show_when_value ?? ""))}</span>
        </span>
      </span>
      <UrgencyMenu
        runId={runId}
        fieldId={field.id}
        fieldName={field.name}
        answer={field.answer}
        options={options}
        trigger="set"
      />
    </li>
  );
}

/** Розділ: назва, прогрес розділу за показаними задачами, задачі й (для того, хто відповідає) рядки-«привиди». */
export function RunSection(props: {
  runId: string;
  name: string;
  tasks: readonly RunTask[];
  allTasks: readonly RunTask[];
  fieldById: Map<string, RunField>;
  names: Map<string, string>;
  viewer: Viewer;
  runManagerId: string;
  canAnswer: boolean;
  optionsOf: (field: RunField) => FieldOption[];
}) {
  const shown = props.tasks.filter((task) => task.is_shown);
  const hidden = props.canAnswer ? props.tasks.filter((task) => !task.is_shown) : [];
  if (shown.length === 0 && hidden.length === 0) return null;
  const fieldOf = (task: RunTask) => (task.show_when_field_id ? props.fieldById.get(task.show_when_field_id) : undefined);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{props.name}</h2>
        <span className="text-sm tabular-nums text-muted-foreground" data-testid="section-progress">
          {formatProgress(shown.filter((task) => task.status === "done").length, shown.length)}
        </span>
      </div>
      <Card className="gap-0 py-0">
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((task) => (
            <TaskRow
              key={task.id}
              runId={props.runId}
              task={task}
              allTasks={props.allTasks}
              field={fieldOf(task)}
              assignee={props.names.get(task.assignee_id) ?? "—"}
              viewer={props.viewer}
              runManagerId={props.runManagerId}
            />
          ))}
          {hidden.map((task) => {
            const field = fieldOf(task);
            return field ? (
              <HiddenTaskRow key={task.id} runId={props.runId} task={task} field={field} options={props.optionsOf(field)} />
            ) : null;
          })}
        </ul>
      </Card>
    </section>
  );
}
