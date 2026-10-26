"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { LABELS } from "@/lib/runs/messages";
import { markTaskDone } from "./actions";

// Підтвердження з назвою задачі й «This cannot be undone» — лише для останньої обов'язкової задачі, яка завершить
// запуск; скасування нічого не змінює (рішення PM у solomchaak/property-workflows-spec#15; AC-TASK-04, AC-TASK-16).
// Решту задач позначають одразу (AC-TASK-01, AC-TASK-02, AC-TASK-07).
// Незворотну дію підтверджують кнопкою destructive (DESIGN.md, розділ 5).
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
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          {LABELS.markAsDone}
        </Button>
      </div>
    );
  }

  return (
    <form action={markTaskDone} className="flex flex-wrap items-center gap-2" role="group" aria-label={LABELS.confirmGroup}>
      <input type="hidden" name="run_id" value={runId} />
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="confirmed" value="true" />
      <span className="text-sm">{LABELS.confirmMarkAsDone(taskName)}</span>
      <ConfirmButton />
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
        {LABELS.cancel}
      </Button>
    </form>
  );
}

function MarkNowButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? LABELS.saving : LABELS.markAsDone}
    </Button>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? LABELS.saving : LABELS.confirm}
    </Button>
  );
}
