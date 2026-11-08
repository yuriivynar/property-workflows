import { cn } from "cn"
import { RUN_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/runs/messages"

// Єдине місце, де статус отримує слово й колір (DESIGN.md, розділи 2 і 5): сторінки передають лише статус,
// тож той самий статус скрізь має те саме слово й той самий токен, і колір ніколи не буває без слова.
const STATUSES = {
  to_do: { label: TASK_STATUS_LABELS.to_do, className: "bg-status-todo text-status-todo-foreground" },
  done: { label: TASK_STATUS_LABELS.done, className: "bg-status-done text-status-done-foreground" },
  in_progress: {
    label: RUN_STATUS_LABELS.in_progress,
    className: "bg-status-in-progress text-status-in-progress-foreground",
  },
  completed: { label: RUN_STATUS_LABELS.completed, className: "bg-status-done text-status-done-foreground" },
  unpublished: {
    label: "Unpublished changes",
    className: "bg-status-unpublished text-status-unpublished-foreground",
  },
} as const

type Status = keyof typeof STATUSES

function isStatus(value: string): value is Status {
  return Object.hasOwn(STATUSES, value)
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (!isStatus(status)) return <span className={className}>{status}</span>
  const { label, className: tone } = STATUSES[status]
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap ring-1 ring-current/20 ring-inset before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        tone,
        status === "done" || status === "completed" ? "animate-pop" : null,
        className
      )}
    >
      {label}
    </span>
  )
}

export { StatusBadge, STATUSES }
