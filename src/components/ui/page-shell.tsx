import { cn } from "cn"
import { MainNav } from "@/components/ui/main-nav"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import type { Theme } from "@/lib/theme"

// Спільний макет усіх сторінок: кольорова шапка з назвою продукту, навігацією й вибором «Theme», вміст — нижче.
// Сторінка входу, відмова («Not enough rights») і «не знайдено» — у тому самому макеті (DESIGN.md, «Стани»; AC-DSYS-02,
// AC-DSYS-03). Вибір «Theme» — на кожній сторінці, зокрема на сторінці входу (ADR 0004; AC-DSYS-05, AC-DSYS-06).
// На телефоні: назва й «Theme» в одному рядку, навігація — окремим рядком нижче.
function PageShell({
  signedIn,
  showTemplates = true,
  theme,
  children,
  className,
}: {
  signedIn: boolean
  showTemplates?: boolean
  theme: Theme
  children: React.ReactNode
  className?: string
}) {
  const items = [
    ...(showTemplates ? [{ href: "/templates", label: "Templates" }] : []),
    { href: "/runs", label: "Runs" },
    { href: "/", label: "Profile" },
  ]
  return (
    <div data-slot="page-shell" className={cn("flex min-h-full flex-1 flex-col", className)}>
      <header className="border-b border-hero-border bg-hero text-hero-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:gap-x-6 sm:min-h-[60px] sm:px-6 sm:py-0">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold whitespace-nowrap sm:text-base">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 sm:size-7">
              <rect width="24" height="24" rx="6" className="fill-hero-foreground" />
              <path
                d="M7 17h5v-5h5V8"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-hero"
              />
              <circle cx="7" cy="17" r="1.6" className="fill-hero" />
              <circle cx="17" cy="8" r="1.6" className="fill-hero" />
            </svg>
            Property workflows
          </span>
          {signedIn ? <MainNav items={items} /> : null}
          <div className="ml-auto">
            <ThemeSwitch value={theme} />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

export { PageShell }
