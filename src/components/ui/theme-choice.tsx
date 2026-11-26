"use client"

import { useEffect, useState } from "react"
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme"
import { applyTheme } from "@/lib/theme-dom"

const THEME_ICONS: Record<Theme, LucideIcon> = { system: Monitor, light: Sun, dark: Moon }

// Кілька виборів теми на сторінці (меню користувача, Sheet телефону, Profile) — вибір в одному сповіщає інші.
const THEME_EVENT = "theme-choice:change"

/** Стан вибору теми: одразу data-theme на <html> і cookie на пристрої (ADR 0004; AC-DSYS-05, AC-DSYS-06). */
function useThemeChoice(value: Theme): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(value)
  useEffect(() => {
    const sync = (event: Event) => setTheme((event as CustomEvent<Theme>).detail)
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])
  function choose(next: Theme) {
    setTheme(next)
    applyTheme(next)
    window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: next }))
  }
  return [theme, choose]
}

/** «Theme: System» — ім'я опції для читачів екрана й підказка (ADR 0012). */
const themeOptionName = (theme: Theme) => `Theme: ${THEME_LABELS[theme]}`

/**
 * Вибір теми справжніми радіокнопками System · Light · Dark (ADR 0004, ADR 0012). `icons` — лише іконки на екрані
 * (Sheet телефону; ім'я «Theme: …» — у aria-label і підказці title); `labelled` — іконка й слово (сторінка Profile).
 */
function ThemeChoice({
  value,
  name,
  variant = "icons",
  className,
}: {
  value: Theme
  name: string
  variant?: "icons" | "labelled"
  className?: string
}) {
  const [theme, choose] = useThemeChoice(value)
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      data-slot="theme-choice"
      className={cn("inline-flex gap-1 rounded-full border border-border bg-muted p-1", className)}
    >
      {THEMES.map((option) => {
        const Icon = THEME_ICONS[option]
        return (
          <label
            key={option}
            title={variant === "icons" ? themeOptionName(option) : undefined}
            className={cn(
              "relative flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) has-[:checked]:bg-card has-[:checked]:text-foreground has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring sm:h-9",
              variant === "icons" ? "w-11 sm:w-9" : "px-3.5"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={theme === option}
              onChange={() => choose(option)}
              aria-label={variant === "icons" ? themeOptionName(option) : undefined}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {variant === "labelled" ? THEME_LABELS[option] : null}
          </label>
        )
      })}
    </div>
  )
}

export { ThemeChoice, THEME_ICONS, themeOptionName, useThemeChoice }
