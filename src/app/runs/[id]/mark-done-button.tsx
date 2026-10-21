"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LABELS } from "@/lib/runs/messages";
import { markTaskDone } from "./actions";

// Підтвердження з назвою задачі й «This cannot be undone» — лише для останньої обов'язкової задачі, яка завершить
// запуск; скасування нічого не змінює (рішення PM у solomchaak/property-workflows-spec#15; AC-TASK-04, AC-TASK-16).
// Решту задач позначають одразу (AC-TASK-01, AC-TASK-02, AC-TASK-07).
export function MarkDoneButton({
  runId,
  taskId,
  taskName,
  confirm,
}: {
  runId: string;
  taskId: string;
  taskName: string;
  confirm: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirm) {
    return (
      <form action={markTaskDone}>
        <input type="hidden" name="run_id" value={runId} />
        <input type="hidden" name="task_id" value={taskId} />
        <MarkNowButton />
      </form>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
      >
        {LABELS.markAsDone}
      </button>
    );
  }

  return (
    <form action={markTaskDone} className="flex flex-wrap items-center gap-2" role="group" aria-label={LABELS.confirmGroup}>
      <input type="hidden" name="run_id" value={runId} />
      <input type="hidden" name="task_id" value={taskId} />
      <span className="text-sm">{LABELS.confirmMarkAsDone(taskName)}</span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
      >
        {LABELS.cancel}
      </button>
    </form>
  );
}

function MarkNowButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
    >
      {pending ? LABELS.saving : LABELS.markAsDone}
    </button>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-3 py-1 text-sm font-medium text-background disabled:opacity-50"
    >
      {pending ? LABELS.saving : LABELS.confirm}
    </button>
  );
}
