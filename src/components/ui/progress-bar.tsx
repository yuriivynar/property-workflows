import { cn } from "cn"

// Смужка прогресу «N of M done»: лише доповнює текст поруч (він лишається словами), тому для читачів екрана прихована.
// Синя, поки запуск іде, зелена, коли виконано все — ті самі кольори за змістом, що й у StatusBadge.
function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const complete = total > 0 && done >= total
  return (
    <span
      aria-hidden="true"
      data-slot="progress-bar"
      className={cn("block h-2 w-24 shrink-0 overflow-hidden rounded-full bg-border", className)}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width,background-color] duration-500 ease-out",
          complete ? "bg-fill-done" : "bg-fill-progress"
        )}
        style={{ width: `${percent}%` }}
      />
    </span>
  )
}

export { ProgressBar }
