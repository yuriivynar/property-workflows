"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutTemplate, ListChecks, UserRound, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import type { NavItem } from "@/lib/auth/nav"

const ICONS: Record<string, LucideIcon> = { "/templates": LayoutTemplate, "/runs": ListChecks, "/": UserRound }

// Головна навігація (ADR 0008): один <nav aria-label="Main">; від lg — вертикальні пункти в графітовій бічній панелі,
// на телефоні — нижні вкладки на тлі картки (цілі ≥ 44 px). Кожен пункт — іконка (декоративна) і слово; поточний
// розділ позначено фоном і aria-current (не акцентом: акцент — лише головна дія екрана). «Profile» — це «/», тож збіг
// із ним точний; решта — за початком шляху. Пункти — за роллю (navItems, AC-VENDOR-13).
function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:grid max-lg:auto-cols-fr max-lg:grid-flow-col max-lg:gap-1 max-lg:border-t max-lg:border-border max-lg:bg-card max-lg:px-2 max-lg:pt-1.5 max-lg:pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:flex lg:flex-col lg:gap-1"
    >
      {items.map((item) => {
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        const Icon = ICONS[item.href]
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              "max-lg:h-14 max-lg:flex-col max-lg:justify-center max-lg:gap-1 max-lg:text-xs max-lg:text-muted-foreground max-lg:focus-visible:outline-ring",
              "lg:h-10 lg:gap-3 lg:px-3 lg:text-sm lg:text-hero-muted lg:hover:bg-hero-hover lg:hover:text-hero-foreground lg:focus-visible:outline-hero-foreground",
              current && "max-lg:bg-muted max-lg:text-foreground lg:bg-hero-hover lg:text-hero-foreground"
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0 lg:size-[18px]" /> : null}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export { MainNav }
