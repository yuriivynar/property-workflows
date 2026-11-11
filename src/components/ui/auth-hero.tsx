"use client"

import { useEffect, useState } from "react"
import { cn } from "cn"

// Декоративна панель сторінки входу (ADR 0007, ADR 0008): кільце процесу заповнюється третинами, три точки-задачі на
// ньому по черзі стають зеленими, слово в центрі змінюється «to do» → «in progress» → «completed», під ним — лічильник
// «N of 3 done», наприкінці — хвиля. Колір слів і кільця — ті самі за змістом, що й у StatusBadge. Слова й лічильник
// задає CSS (content у globals.css), тож у тексті сторінки їх немає: сторінка входу не містить жодних даних запусків.
// Рухаються лише transform, opacity і stroke-dashoffset; анімації — у globals.css (auth-*), вимкнені для
// prefers-reduced-motion. Малюнок — aria-hidden. Рух довший за 5 секунд можна поставити на паузу кнопкою (WCAG 2.2.2,
// стан — aria-pressed); коли вкладку сховано, рух стоїть сам.
const NODES = [
  { cx: 172.7, cy: 142 },
  { cx: 27.3, cy: 142 },
  { cx: 100, cy: 16 },
]

function AuthHero({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden")
    update()
    document.addEventListener("visibilitychange", update)
    return () => document.removeEventListener("visibilitychange", update)
  }, [])

  return (
    <div
      data-slot="auth-hero"
      data-paused={paused || hidden}
      className={cn("relative h-full min-h-[520px] overflow-hidden bg-hero text-hero-foreground", className)}
    >
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
        <span className="auth-orb auth-orb-3" />
        <span className="auth-orb auth-orb-2" />
        <span className="auth-orb auth-orb-1" />
        <div className="auth-ring-wrap relative grid size-[230px] place-items-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
            <circle className="auth-ring-track" cx="100" cy="100" r="84" fill="none" strokeWidth="9" strokeLinecap="round" />
            <circle
              className="auth-ring-fill"
              cx="100"
              cy="100"
              r="84"
              pathLength="100"
              transform="rotate(-90 100 100)"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {NODES.map((node, index) => (
              <circle key={index} className={`auth-node auth-node-${index + 1}`} cx={node.cx} cy={node.cy} r="7" strokeWidth="3" />
            ))}
          </svg>
          <div className="auth-core relative grid place-items-center gap-2">
            <span className="grid">
              <span className="auth-word auth-word-1 rounded-full bg-status-todo px-3.5 py-1 text-[15px] font-semibold text-status-todo-foreground" />
              <span className="auth-word auth-word-2 rounded-full bg-status-in-progress px-3.5 py-1 text-[15px] font-semibold text-status-in-progress-foreground" />
              <span className="auth-word auth-word-3 rounded-full bg-status-done px-3.5 py-1 text-[15px] font-semibold text-status-done-foreground" />
            </span>
            <span className="auth-count text-[13px] text-hero-muted tabular-nums" />
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused((current) => !current)}
        className="absolute bottom-4 left-4 rounded-full border border-hero-border bg-hero-hover px-3.5 py-2 text-sm font-medium text-hero-muted outline-none transition-colors hover:text-hero-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-foreground"
      >
        {paused ? "Play animation" : "Pause animation"}
      </button>
    </div>
  )
}

export { AuthHero }
