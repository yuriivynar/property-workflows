import { cn } from "@/lib/utils"
import { progressPercent } from "./progress-bar"

const RADIUS = 36
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Кільце прогресу картки деталей запуску (полотно UI v3, ADR 0012): лише доповнює текст «N of M done» поруч, тому для
// читачів екрана приховане. Синє, поки запуск іде, зелене, коли виконано все; дуга змінюється за stroke-dashoffset
// (рух «state change» — вимикає prefers-reduced-motion). Незавершений прогрес ніколи не виглядає повним (progressPercent).
function ProgressRing({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = progressPercent(done, total)
  const complete = percent === 100
  return (
    <svg
      aria-hidden="true"
      data-slot="progress-ring"
      viewBox="0 0 84 84"
      className={cn("size-20 shrink-0 -rotate-90", className)}
    >
      <circle cx="42" cy="42" r={RADIUS} fill="none" strokeWidth="8" className="stroke-border" />
      <circle
        cx="42"
        cy="42"
        r={RADIUS}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
        className={cn(
          "transition-[stroke-dashoffset,stroke] duration-500 ease-standard motion-reduce:transition-none",
          complete ? "stroke-fill-done" : "stroke-fill-progress",
          percent === 0 && "opacity-0"
        )}
      />
    </svg>
  )
}

export { ProgressRing }
