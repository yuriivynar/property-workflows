import Link from "next/link"
import { cn } from "cn"
import { BrandMark } from "@/components/ui/brand-mark"
import { MainNav } from "@/components/ui/main-nav"
import { PageTransition } from "@/components/ui/page-transition"
import { CommandPalette } from "@/components/ui/command-palette"
import type { SearchItem } from "@/app/search/actions"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import { UserMenu, UserSheet } from "@/components/ui/user-menu"
import { navItems } from "@/lib/auth/nav"
import type { Theme } from "@/lib/theme"

// Спільний макет усіх сторінок (ADR 0008, ADR 0012). Увійшов: від lg — графітова бічна панель (логотип, навігація,
// внизу меню користувача з вибором «Theme», Profile і Sign out), на телефоні — графітова смуга з логотипом і аватаром
// (Sheet з «Theme» і Sign out) та нижні вкладки навігації. Не увійшов (вхід): без кольорової смуги — великий логотип і «Theme»
// в одному рядку на тлі сторінки. Відмова («Not enough rights»), «не знайдено» й вхід — у тому самому макеті
// (DESIGN.md, «Стани»; AC-DSYS-02, AC-DSYS-03). Вибір «Theme» — на кожній сторінці (ADR 0004; AC-DSYS-05, AC-DSYS-06);
// key: якщо сервер віддав іншу тему (cookie змінили в іншій вкладці), перемикач відтворюється з нею.
function PageShell({
  signedIn,
  role,
  email,
  theme,
  signOut,
  avatarSrc,
  search,
  children,
  className,
}: {
  signedIn: boolean
  /** Роль із profiles: від неї залежать пункти навігації (AC-VENDOR-13). */
  role?: string | null
  /** Email того, хто увійшов (власний профіль), — унизу бічної панелі. */
  email?: string | null
  theme: Theme
  /** Дані палітри ⌘K (Server Action searchIndex) — лише після входу. */
  search: () => Promise<SearchItem[]>
  /** Власне фото для аватара (/api/avatar), якщо є. */
  avatarSrc?: string | null
  /** Server Action виходу — для меню користувача й Sheet телефону. */
  signOut: () => Promise<void>
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
          <div className="flex items-center gap-1 lg:hidden">
            <CommandPalette load={search} tone="bar" />
            <UserSheet key={theme} email={email} role={role} theme={theme} signOut={signOut} avatarSrc={avatarSrc} />
          </div>
        </div>
        <div className="hidden px-0 lg:block">
          <CommandPalette load={search} />
        </div>
        <MainNav items={navItems(role)} />
        <div className="mt-auto hidden border-t border-hero-border pt-3 lg:block">
          <UserMenu key={theme} email={email} role={role} theme={theme} signOut={signOut} avatarSrc={avatarSrc} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col max-lg:pb-20">
        <PageTransition>{children}</PageTransition>
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
