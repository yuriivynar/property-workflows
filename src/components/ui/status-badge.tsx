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
        "inline-flex h-5 w-fit shrink-0 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        tone,
        className
      )}
    >
      {label}
    </span>
  )
}

export { StatusBadge, STATUSES }
