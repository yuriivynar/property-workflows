import { cn } from "cn"

// Смужка прогресу «N of M done»: лише доповнює текст поруч (він лишається словами), тому для читачів екрана прихована.
// Синя, поки запуск іде, зелена, коли виконано все — ті самі кольори за змістом, що й у StatusBadge. Незавершений
// прогрес ніколи не виглядає повним: 199 із 200 — це 99 %, а не 100.
function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0
  if (done >= total) return 100
  return Math.min(99, Math.max(0, Math.floor((done / total) * 100)))
}

function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = progressPercent(done, total)
  const complete = percent === 100
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

export { ProgressBar, progressPercent }
