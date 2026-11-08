"use client"

import { useState } from "react"
import { cn } from "cn"

// Декоративна панель сторінки входу: кільце процесу заповнюється, а слово в центрі змінюється «to do» → «in progress» →
// «completed». Колір слова й кільця — ті самі за змістом, що й у StatusBadge. Слова задає CSS (content у globals.css),
// тож у тексті сторінки їх немає: сторінка входу не містить жодних даних запусків. Анімації — у globals.css (auth-*),
// вимкнені для prefers-reduced-motion. Малюнок — aria-hidden; рух довший за 5 секунд можна поставити на паузу кнопкою
// (WCAG 2.2.2): кнопка поза aria-hidden, її стан — aria-pressed.
function AuthHero({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false)
  return (
    <div
      data-slot="auth-hero"
      data-paused={paused}
      className={cn("relative min-h-[480px] overflow-hidden rounded-3xl bg-hero text-hero-foreground shadow-card", className)}
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
          </svg>
          <div className="auth-core relative grid place-items-center">
            <span className="auth-word auth-word-1 rounded-full bg-status-todo px-3.5 py-1 text-[15px] font-semibold text-status-todo-foreground" />
            <span className="auth-word auth-word-2 rounded-full bg-status-in-progress px-3.5 py-1 text-[15px] font-semibold text-status-in-progress-foreground" />
            <span className="auth-word auth-word-3 rounded-full bg-status-done px-3.5 py-1 text-[15px] font-semibold text-status-done-foreground" />
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
