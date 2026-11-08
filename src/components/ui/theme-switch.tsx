"use client"

import { useState } from "react"
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme"
import { applyTheme } from "@/lib/theme-dom"

// Вибір «Theme» у спільному макеті (ADR 0004, ADR 0007; AC-DSYS-05, AC-DSYS-06): три позначки System · Light · Dark
// на справжніх радіокнопках (клавіатура й читачі екрана працюють без зусиль). Зміна одразу ставить data-theme на
// <html> і пише cookie на пристрої; сервер читає cookie під час наступного рендеру, тож спалаху іншої теми немає.
// Напис «Theme» на вузькому екрані ховаємо візуально — назва групи лишається в aria-label.
function ThemeSwitch({ value }: { value: Theme }) {
  const [theme, setTheme] = useState<Theme>(value)

  function choose(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-2.5 text-sm text-hero-muted">
      <span aria-hidden="true" className="max-sm:hidden">
        Theme
      </span>
      <span className="inline-flex gap-0.5 rounded-full border border-hero-border bg-hero-hover p-[3px]">
        {THEMES.map((option) => (
          <label key={option} className="relative block cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => choose(option)}
              onClick={() => choose(option)}
              className="peer absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span className="block rounded-full px-2 py-[11px] text-[13px] font-medium text-hero-muted transition-colors peer-checked:bg-hero-foreground peer-checked:text-hero peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hero-foreground hover:text-hero-foreground sm:px-3 sm:py-1 sm:text-sm">
              {THEME_LABELS[option]}
            </span>
          </label>
        ))}
      </span>
    </div>
  )
}

export { ThemeSwitch }
