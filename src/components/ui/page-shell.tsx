import { cn } from "cn"
import { TextLink } from "@/components/ui/text-link"
import { ThemeSelect } from "@/components/ui/theme-select"
import type { Theme } from "@/lib/theme"

// Спільний макет усіх сторінок: назва продукту й навігація однаково зверху, вміст — нижче. Сторінка входу, відмова
// («Not enough rights») і «не знайдено» — у тому самому макеті (DESIGN.md, «Стани»; AC-DSYS-02, AC-DSYS-03).
// Вибір «Theme» — на кожній сторінці, зокрема на сторінці входу (ADR 0004; AC-DSYS-05, AC-DSYS-06).
function PageShell({
  signedIn,
  theme,
  children,
  className,
}: {
  signedIn: boolean
  theme: Theme
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="page-shell" className={cn("flex min-h-full flex-1 flex-col", className)}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-semibold">Property workflows</span>
          <div className="flex flex-wrap items-center gap-4">
            {signedIn ? (
              <nav aria-label="Main" className="flex gap-4 text-sm">
                <TextLink href="/templates">Templates</TextLink>
                <TextLink href="/runs">Runs</TextLink>
                <TextLink href="/">Profile</TextLink>
              </nav>
            ) : null}
            <ThemeSelect value={theme} />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

export { PageShell }
