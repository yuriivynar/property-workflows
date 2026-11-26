import Link from "next/link"
import { cn } from "cn"
import { BrandMark } from "@/components/ui/brand-mark"
import { MainNav } from "@/components/ui/main-nav"
import { PageTransition } from "@/components/ui/page-transition"
import { CommandPalette } from "@/components/ui/command-palette"
import type { SearchItem } from "@/app/search/actions"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import { UserMenu, UserSheet } from "@/components/ui/user-menu"
import { SidebarControls, SidebarFrame } from "@/components/ui/sidebar-frame"
import type { SidebarState } from "@/lib/sidebar"
import { navItems } from "@/lib/auth/nav"
import type { Theme } from "@/lib/theme"

// Спільний макет усіх сторінок (ADR 0008, ADR 0012). Увійшов: від lg — графітова бічна панель (логотип, навігація,
// внизу меню користувача з вибором «Theme», Profile і Sign out), на телефоні — графітова смуга з логотипом і аватаром
// (Sheet з «Theme» і Sign out) та нижні вкладки навігації. Від lg панель розгорнута, згорнута чи прихована (SidebarFrame,
// cookie «sidebar»; ADR 0012, доповнення). Не увійшов (вхід): без кольорової смуги — великий логотип і «Theme»
// в одному рядку на тлі сторінки. Відмова («Not enough rights»), «не знайдено» й вхід — у тому самому макеті
// (DESIGN.md, «Стани»; AC-DSYS-02, AC-DSYS-03). Вибір «Theme» — на кожній сторінці (ADR 0004; AC-DSYS-05, AC-DSYS-06);
// key: якщо сервер віддав іншу тему (cookie змінили в іншій вкладці), перемикач відтворюється з нею.
function PageShell({
  signedIn,
  role,
  email,
  theme,
  sidebar = "expanded",
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
  /** Стан бічної панелі від lg (cookie «sidebar»): розгорнута, згорнута чи прихована. */
  sidebar?: SidebarState
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
    <SidebarFrame
      initial={sidebar}
      sidebar={
        <>
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-auto lg:px-2 lg:group-data-[state=collapsed]/sidebar:flex-col lg:group-data-[state=collapsed]/sidebar:px-0">
            <Brand tone="hero" href="/runs" />
            <SidebarControls />
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
        </>
      }
    >
      <PageTransition>{children}</PageTransition>
    </SidebarFrame>
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
        <span className="text-[15px] font-semibold whitespace-nowrap lg:group-data-[state=collapsed]/sidebar:sr-only">Property workflows</span>
      )}
    </Link>
  )
}

export { PageShell }
