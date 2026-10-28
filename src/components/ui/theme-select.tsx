"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { parseTheme, THEME_LABELS, THEMES, themeAttribute, themeCookie, type Theme } from "@/lib/theme"

// Вибір «Theme» у спільному макеті (ADR 0004; AC-DSYS-05, AC-DSYS-06): зміна одразу ставить data-theme на <html> і
// пише cookie на пристрої; сервер читає cookie під час наступного рендеру, тож спалаху іншої теми немає.
function ThemeSelect({ value }: { value: Theme }) {
  const [theme, setTheme] = useState<Theme>(value)

  function choose(next: Theme) {
    setTheme(next)
    document.cookie = themeCookie(next)
    const attribute = themeAttribute(next)
    if (attribute) document.documentElement.dataset.theme = attribute
    else delete document.documentElement.dataset.theme
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Label htmlFor="theme" className="font-normal">
        Theme
      </Label>
      <NativeSelect id="theme" value={theme} onChange={(e) => choose(parseTheme(e.target.value))}>
        {THEMES.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {THEME_LABELS[option]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

export { ThemeSelect }
