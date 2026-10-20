"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { markTaskDone } from "./actions";

// Позначка остаточна, тож спершу підтвердження з назвою задачі (робоче рішення до відповіді на
// solomchaak/property-workflows-spec#15). Скасування нічого не змінює.
export function MarkDoneButton({ runId, taskId, taskName }: { runId: string; taskId: string; taskName: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
      >
        Mark as done
      </button>
    );
  }

  return (
    <form action={markTaskDone} className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm mark as done">
      <input type="hidden" name="run_id" value={runId} />
      <input type="hidden" name="task_id" value={taskId} />
      <span className="text-sm">
        Mark «{taskName}» as done? This cannot be undone.
      </span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
      >
        Cancel
      </button>
    </form>
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
      {pending ? "Saving…" : "Confirm"}
    </button>
  );
}
