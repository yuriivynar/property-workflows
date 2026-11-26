"use client";

import { useOptimistic, useState } from "react";
import { CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { markTaskDoneInPlace } from "./runs/[id]/actions";
import { MarkDoneButton } from "./runs/[id]/mark-done-button";

/**
 * Наступна задача на Profile («Your next tasks», рішення власника 2026-11-26, ADR 0012): назва веде на запуск, позначка —
 * на місці (useOptimistic), відмова — дослівний текст AC у рядку; останню обов'язкову підтверджують, як на сторінці
 * запуску (AC-TASK-04, AC-TASK-16).
 */
export function NextTaskRow({
  runId,
  taskId,
  name,
  caseName,
  confirm,
}: {
  runId: string;
  taskId: string;
  name: string;
  caseName: string;
  confirm: boolean;
}) {
  const [status, setStatus] = useOptimistic("to_do");
  const [error, setError] = useState<string | null>(null);

  async function mark(formData: FormData) {
    setError(null);
    setStatus("done");
    const result = await markTaskDoneInPlace(formData);
    if (result.error) setError(result.error);
  }

  return (
    <li data-testid="next-task" className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <TextLink href={`/runs/${runId}`} className="font-medium no-underline hover:underline [overflow-wrap:anywhere]">
            {name}
          </TextLink>
          <span className="text-muted-foreground [overflow-wrap:anywhere]">{caseName}</span>
        </span>
        <StatusBadge status={status} />
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {status !== "done" ? <MarkDoneButton runId={runId} taskId={taskId} taskName={name} confirm={confirm} action={mark} /> : null}
    </li>
  );
}
