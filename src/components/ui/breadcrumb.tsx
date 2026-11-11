import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"

// Хлібні крихти над заголовком сторінки (ADR 0008): «Runs › Apartment 12, move-in» замість посилань «Back to …» унизу
// звичайних сторінок. Поточна сторінка — останній пункт без посилання, aria-current="page"; шеврони — декоративні.
function Breadcrumb({
  items,
  current,
  className,
}: {
  items: { href: string; label: string }[]
  current: React.ReactNode
  className?: string
}) {
  return (
    <nav aria-label="Breadcrumb" data-slot="breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item) => (
          <li key={item.href} className="flex min-w-0 items-center gap-1.5">
            <Link
              href={item.href}
              className="-mx-1 rounded-md px-1 py-0.5 outline-none transition-colors [overflow-wrap:anywhere] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
            <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          </li>
        ))}
        <li aria-current="page" className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">
          {current}
        </li>
      </ol>
    </nav>
  )
}

export { Breadcrumb }
