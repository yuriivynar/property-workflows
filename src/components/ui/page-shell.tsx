import { cn } from "cn"
import { TextLink } from "@/components/ui/text-link"

// Спільний макет усіх сторінок: назва продукту й навігація однаково зверху, вміст — нижче. Сторінка входу, відмова
// («Not enough rights») і «не знайдено» — у тому самому макеті (DESIGN.md, «Стани»; AC-DSYS-02, AC-DSYS-03).
function PageShell({
  signedIn,
  children,
  className,
}: {
  signedIn: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="page-shell" className={cn("flex min-h-full flex-1 flex-col", className)}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-semibold">Property workflows</span>
          {signedIn ? (
            <nav aria-label="Main" className="flex gap-4 text-sm">
              <TextLink href="/templates">Templates</TextLink>
              <TextLink href="/runs">Runs</TextLink>
              <TextLink href="/">Profile</TextLink>
            </nav>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  )
}

export { PageShell }
