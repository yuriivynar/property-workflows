"use client";

import { useOptimistic, useState } from "react";
import { CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { markTaskDoneInPlace } from "./actions";
import { MarkDoneButton } from "./mark-done-button";
import type { InPlaceResult } from "./actions";
import { useNeedsConfirmation, useRunMarks } from "./run-marks";

/**
 * Рядок задачі запуску з миттєвою позначкою (ADR 0012, полотно UI v3 «Instant feedback»): «done» видно одразу, сервер
 * підтверджує у фоні. На сторінці запуску позначка йде через RunMarksProvider — тож одразу оновлюються прогрес і те,
 * яка задача тепер остання обов'язкова: вона просить підтвердження ще до запиту (AC-TASK-04, AC-TASK-16). Якщо база
 * все ж відповіла, що задача остання (NEEDS_CONFIRMATION — дані сторінки встигли застаріти), рядок показує
 * підтвердження, а не помилку. Інша відмова повертає рядок на місці — «to do» і дослівний текст AC (AC-TASK-03).
 * Хто може позначити, вирішує сторінка (canMarkTask) і остаточно — база.
 */
/** Статус на екрані: позначка запуску (RunMarksProvider) або власна миттєва позначка рядка. */
function shownStatusOf(marked: boolean | undefined, localStatus: string): string {
  return marked ? "done" : localStatus;
}

/** Відповідь сервера → що показати: NEEDS_CONFIRMATION — підтвердження, інша відмова — текст AC у рядку. */
function outcomeOf(result: InPlaceResult): { ask: boolean; error: string | null } {
  const ask = result.code === "NEEDS_CONFIRMATION";
  return { ask, error: ask ? null : result.error };
}

/** Стан позначки рядка: миттєвий статус, чи просити підтвердження, текст відмови й дія форми. */
function useTaskMark(taskId: string, status: string, confirm: boolean) {
  const marks = useRunMarks();
  // Без RunMarksProvider (рядок поза сторінкою запуску) — власна миттєва позначка.
  const [localStatus, setLocalStatus] = useOptimistic(status);
  const needsConfirm = useNeedsConfirmation(taskId, confirm);
  const [askConfirm, setAskConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markOptimistic = marks ? () => marks.markDone(taskId) : () => setLocalStatus("done");

  async function mark(formData: FormData) {
    setError(null);
    markOptimistic();
    const outcome = outcomeOf(await markTaskDoneInPlace(formData));
    setAskConfirm(outcome.ask);
    setError(outcome.error);
  }

  return {
    shownStatus: shownStatusOf(marks?.done.has(taskId), localStatus),
    confirm: needsConfirm || askConfirm,
    askConfirm,
    error,
    mark,
  };
}

function TaskLabel({ name, requiredText, conditionText }: { name: string; requiredText: string; conditionText?: string }) {
  return (
    <span className="min-w-0 [overflow-wrap:anywhere]">
      {name} <span className="text-muted-foreground">({requiredText})</span>
      {conditionText ? <span className="block text-muted-foreground">{conditionText}</span> : null}
    </span>
  );
}

function TaskError({ id, error }: { id: string; error: string | null }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-base)">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  );
}

export function TaskItem({
  runId,
  taskId,
  name,
  requiredText,
  conditionText,
  assignee,
  status,
  canMark,
  confirm,
}: {
  runId: string;
  taskId: string;
  name: string;
  requiredText: string;
  conditionText?: string;
  assignee: string;
  status: string;
  canMark: boolean;
  confirm: boolean;
}) {
  const task = useTaskMark(taskId, status, confirm);
  const errorId = `task-error-${taskId}`;

  return (
    <li
      data-testid="run-task"
      aria-describedby={task.error ? errorId : undefined}
      className="flex flex-col gap-2.5 px-4 py-3.5 text-sm transition-colors duration-(--duration-fast) hover:bg-glow max-sm:[&_[data-slot=button]]:w-full max-sm:[&_form]:w-full"
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <TaskLabel name={name} requiredText={requiredText} conditionText={conditionText} />
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
          <span>{assignee}</span>
          <span data-testid="task-status">
            <StatusBadge status={task.shownStatus} />
          </span>
        </span>
      </div>
      <TaskError id={errorId} error={task.error} />
      {canMark && task.shownStatus !== "done" ? (
        <MarkDoneButton
          // Новий ключ відкриває підтвердження одразу, коли про нього попросила база.
          key={String(task.askConfirm)}
          runId={runId}
          taskId={taskId}
          taskName={name}
          confirm={task.confirm}
          startConfirming={task.askConfirm}
          action={task.mark}
        />
      ) : null}
    </li>
  );
}
