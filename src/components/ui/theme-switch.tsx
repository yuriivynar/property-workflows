"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme"
import { applyTheme } from "@/lib/theme-dom"

const ICONS: Record<Theme, LucideIcon> = { system: Monitor, light: Sun, dark: Moon }

// PageShell монтує два перемикачі (смуга телефону й рядок над вмістом від lg): вибір в одному сповіщає інший,
// щоб після зміни ширини вікна обидва показували ту саму тему.
const THEME_EVENT = "theme-switch:change"

// Вибір «Theme» (ADR 0004, ADR 0008; AC-DSYS-05, AC-DSYS-06): компактне меню в правому верхньому куті кожної сторінки.
// Закрите показує «Theme» і поточне значення («Theme System»), відкрите — три справжні радіокнопки System · Light ·
// Dark з іконкою й словом. Меню — нативні <details>/<summary>: відкривається клавіатурою й без JavaScript; Escape і
// клік поза меню закривають його. Зміна одразу ставить data-theme на <html> і пише cookie на пристрої.
// tone: "surface" — на тлі сторінки (вхід, рядок над вмістом), "hero" — на графітовій смузі телефону.
function ThemeSwitch({ value, tone = "surface", name = "theme" }: { value: Theme; tone?: "surface" | "hero"; name?: string }) {
  const [theme, setTheme] = useState<Theme>(value)
  const menu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const close = (event: Event) => {
      const details = menu.current
      if (!details?.open) return
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) {
        details.open = false
        if (event instanceof KeyboardEvent) details.querySelector("summary")?.focus()
      }
    }
    const sync = (event: Event) => setTheme((event as CustomEvent<Theme>).detail)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    window.addEventListener(THEME_EVENT, sync)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
      window.removeEventListener(THEME_EVENT, sync)
    }
  }, [])

  function choose(next: Theme) {
    setTheme(next)
    applyTheme(next)
    window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: next }))
    if (menu.current) menu.current.open = false
  }

  const CurrentIcon = ICONS[theme]
  return (
    <details ref={menu} data-slot="theme-switch" className="group relative">
      <summary
        className={cn(
          "flex h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm font-medium outline-none transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-10 [&::-webkit-details-marker]:hidden",
          tone === "hero"
            ? "bg-hero-hover text-hero-foreground focus-visible:outline-hero-foreground"
            : "border border-border bg-card text-card-foreground shadow-card hover:bg-accent focus-visible:outline-ring"
        )}
      >
        <CurrentIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className={cn(tone === "hero" ? "sr-only" : "text-muted-foreground max-sm:sr-only")}>Theme</span>
        <span>{THEME_LABELS[theme]}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="absolute right-0 top-full z-30 mt-1.5 flex min-w-48 flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-card"
      >
        {THEMES.map((option) => {
          const Icon = ICONS[option]
          return (
            <label
              key={option}
              className="relative flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring sm:h-10"
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={theme === option}
                onChange={() => choose(option)}
                onClick={() => choose(option)}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              {THEME_LABELS[option]}
              <Check aria-hidden="true" className="ml-auto size-4 shrink-0 opacity-0 peer-checked:opacity-100" />
            </label>
          )
        })}
      </div>
    </details>
  )
}

export { ThemeSwitch }
