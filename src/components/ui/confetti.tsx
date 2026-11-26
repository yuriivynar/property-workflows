"use client"

import { useEffect, useState } from "react"
import { cn } from "cn"

// Кольори шматочків — лише токени (DESIGN.md): головна дія, «done», прогрес, теплий жовтий, помилка.
const COLORS = ["bg-primary", "bg-fill-done", "bg-fill-progress", "bg-status-unpublished-foreground", "bg-destructive"] as const
const PIECES = 28
/** Найдовший шматочок: тривалість 1200 + 599 мс і затримка до 299 мс — після цього конфеті прибирається з DOM. */
const LIFETIME_MS = 2200

/** Детерміновані «випадкові» значення за номером шматочка: однаково на сервері й у браузері, без Math.random у рендері. */
function piece(index: number) {
  return {
    left: `${(index * 37) % 100}%`,
    "--confetti-x": `${((index * 73) % 160) - 80}px`,
    "--confetti-r": `${(index * 97) % 720}deg`,
    "--confetti-delay": `${(index * 23) % 300}ms`,
    "--confetti-duration": `${1200 + ((index * 41) % 600)}ms`,
  } as React.CSSProperties
}

/**
 * Конфеті на завершення запуску (рішення власника 2026-11-26, ADR 0012, доповнення): один короткий спалах, коли всі
 * обов'язкові задачі виконано. Лише прикраса: aria-hidden, не перехоплює кліків, прибирається за ~2 с; під
 * prefers-reduced-motion його немає зовсім (globals.css, .confetti-piece). Слово «completed» поруч лишається головним.
 */
function Confetti({ className }: { className?: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <div aria-hidden="true" data-slot="confetti" className={cn("pointer-events-none fixed inset-0 z-50 overflow-hidden", className)}>
      {Array.from({ length: PIECES }, (_, index) => (
        <span key={index} className={cn("confetti-piece", COLORS[index % COLORS.length])} style={piece(index)} />
      ))}
    </div>
  )
}

/**
 * Лічильник спалахів: зростає, коли стан змінився з «не завершено» на «завершено» за життя компонента. Уже завершений
 * запуск, відкритий наново, конфеті не показує. Зміна стану під час рендеру — за порадою React («adjusting state when a
 * prop changes»), без ефекту.
 */
function useCompletionBurst(completed: boolean): number {
  const [previous, setPrevious] = useState(completed)
  const [bursts, setBursts] = useState(0)
  if (previous !== completed) {
    setPrevious(completed)
    if (completed) setBursts((count) => count + 1)
  }
  return bursts
}

export { Confetti, useCompletionBurst }
