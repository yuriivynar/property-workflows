"use client"

import { useEffect, useState } from "react"

// Лічильник, що «набігає» від 0 до значення (ADR 0012, полотно UI v3): 20 кроків по 30 мс, лише при першому показі;
// prefers-reduced-motion — одразу значення. Число для читачів екрана — завжди остаточне (aria-label).
function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let step = 0
    let timer: number | undefined
    // Стан змінюємо лише в колбеках таймера: спершу 0, далі 20 кроків до значення.
    const frame = window.requestAnimationFrame(() => {
      setShown(0)
      timer = window.setInterval(() => {
        step += 1
        setShown(Math.round((value * step) / 20))
        if (step >= 20) window.clearInterval(timer)
      }, 30)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearInterval(timer)
    }
  }, [value])
  return (
    <span aria-label={String(value)} className={className}>
      <span aria-hidden="true">{shown}</span>
    </span>
  )
}

export { CountUp }
