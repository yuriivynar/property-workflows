"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

type NavItem = { href: string; label: string }

// Головна навігація на кольоровій шапці: поточний розділ позначено фоном і aria-current (не акцентом: акцент —
// лише головна дія екрана, ADR 0007). «Profile» — це «/», тож збіг із ним точний; решта — за початком шляху.
function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex gap-1 max-sm:order-3 max-sm:-mx-2 max-sm:basis-full">
      {items.map((item) => {
        const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-2.5 text-sm font-medium text-hero-muted outline-none transition-colors hover:bg-hero-hover hover:text-hero-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-foreground sm:py-1.5",
              current && "bg-hero-hover text-hero-foreground ring-1 ring-hero-border ring-inset"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export { MainNav }
