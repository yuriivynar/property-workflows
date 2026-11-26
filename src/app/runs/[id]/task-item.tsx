"use client";

import { useOptimistic, useState } from "react";
import { CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { markTaskDoneInPlace } from "./actions";
import { MarkDoneButton } from "./mark-done-button";

/**
 * Рядок задачі запуску з миттєвою позначкою (ADR 0012, полотно UI v3 «Instant feedback»): «done» видно одразу
 * (useOptimistic), сервер підтверджує у фоні; відмова повертає рядок на місці — статус «to do» і дослівний текст AC
 * (AC-TASK-03) у цьому ж рядку. Підтвердження останньої обов'язкової задачі — на місці, як і раніше (AC-TASK-04,
 * AC-TASK-16). Хто може позначити, вирішує сторінка (canMarkTask) і остаточно — база.
 */
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
  const [shownStatus, setShownStatus] = useOptimistic(status);
  const [error, setError] = useState<string | null>(null);
  const errorId = `task-error-${taskId}`;

  async function mark(formData: FormData) {
    setError(null);
    setShownStatus("done");
    const result = await markTaskDoneInPlace(formData);
    if (result.error) setError(result.error);
  }

  return (
    <li
      data-testid="run-task"
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2.5 px-4 py-3.5 text-sm transition-colors duration-(--duration-fast) hover:bg-glow max-sm:[&_[data-slot=button]]:w-full max-sm:[&_form]:w-full"
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {name} <span className="text-muted-foreground">({requiredText})</span>
          {conditionText ? <span className="block text-muted-foreground">{conditionText}</span> : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
          <span>{assignee}</span>
          <span data-testid="task-status">
            <StatusBadge status={shownStatus} />
          </span>
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-base)">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {canMark && shownStatus !== "done" ? (
        <MarkDoneButton runId={runId} taskId={taskId} taskName={name} confirm={confirm} action={mark} />
      ) : null}
    </li>
  );
}
