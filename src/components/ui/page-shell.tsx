import Link from "next/link"
import { cn } from "cn"
import { BrandMark } from "@/components/ui/brand-mark"
import { MainNav } from "@/components/ui/main-nav"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import { navItems } from "@/lib/auth/nav"
import type { Theme } from "@/lib/theme"

// Спільний макет усіх сторінок (ADR 0008). Увійшов: від lg — графітова бічна панель (логотип, навігація, email і
// роль), на телефоні — графітова смуга з логотипом і вибором «Theme» та нижні вкладки навігації; вибір «Theme» на
// десктопі — у правому верхньому куті над вмістом. Не увійшов (вхід): без кольорової смуги — великий логотип і «Theme»
// в одному рядку на тлі сторінки. Відмова («Not enough rights»), «не знайдено» й вхід — у тому самому макеті
// (DESIGN.md, «Стани»; AC-DSYS-02, AC-DSYS-03). Вибір «Theme» — на кожній сторінці (ADR 0004; AC-DSYS-05, AC-DSYS-06);
// key: якщо сервер віддав іншу тему (cookie змінили в іншій вкладці), перемикач відтворюється з нею.
function PageShell({
  signedIn,
  role,
  email,
  theme,
  children,
  className,
}: {
  signedIn: boolean
  /** Роль із profiles: від неї залежать пункти навігації (AC-VENDOR-13). */
  role?: string | null
  /** Email того, хто увійшов (власний профіль), — унизу бічної панелі. */
  email?: string | null
  theme: Theme
  children: React.ReactNode
  className?: string
}) {
  if (!signedIn) {
    return (
      <div data-slot="page-shell" className={cn("flex min-h-full flex-1 flex-col", className)}>
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
          <Brand tone="page" href="/login" />
          <ThemeSwitch key={theme} value={theme} />
        </header>
        {children}
      </div>
    )
  }

  return (
    <div data-slot="page-shell" className={cn("flex min-h-full flex-1 flex-col lg:flex-row", className)}>
      <aside
        data-slot="app-sidebar"
        className="bg-hero text-hero-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:gap-8 lg:px-3 lg:py-5"
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:px-2">
          <Brand tone="hero" href="/runs" />
          <div className="lg:hidden">
            <ThemeSwitch key={theme} value={theme} tone="hero" name="theme-mobile" />
          </div>
        </div>
        <MainNav items={navItems(role)} />
        {email ? (
          <div className="mt-auto hidden flex-col gap-0.5 border-t border-hero-border px-2 pt-4 text-sm lg:flex">
            <span className="truncate text-hero-foreground">{email}</span>
            {role ? <span className="text-hero-muted">{role}</span> : null}
          </div>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col max-lg:pb-20">
        <div className="hidden justify-end px-6 pt-4 lg:flex">
          <ThemeSwitch key={theme} value={theme} />
        </div>
        {children}
      </div>
    </div>
  )
}

// Логотип-посилання: на вході — великий двоколірний («Property» + приглушене «workflows»), у застосунку — компактний.
function Brand({ tone, href }: { tone: "page" | "hero"; href: string }) {
  const large = tone === "page"
  return (
    <Link
      href={href}
      className={cn(
        "brand-link flex items-center gap-2.5 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-4",
        large ? "text-foreground focus-visible:outline-ring" : "text-hero-foreground focus-visible:outline-hero-foreground"
      )}
    >
      <BrandMark tone={tone} className={large ? "size-12" : "size-8"} />
      {large ? (
        <span className="flex flex-col text-[22px] leading-[1.05] tracking-tight">
          <span className="font-semibold">Property</span>
          <span className="text-muted-foreground">workflows</span>
        </span>
      ) : (
        <span className="text-[15px] font-semibold whitespace-nowrap">Property workflows</span>
      )}
    </Link>
  )
}

export { PageShell }
