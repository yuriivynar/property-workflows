"use client"

import { ViewTransition } from "react"
import { usePathname } from "next/navigation"

// Перехід між сторінками (ADR 0012): React <ViewTransition> з ключем шляху — нова сторінка з'являється коротким
// кросфейдом із зсувом на 6 px за --duration-slow (CSS .page-enter / .page-exit у globals.css). Навігація в Next.js —
// transition, тож анімація вмикається сама; prefers-reduced-motion — без руху (правило в globals.css).
function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  )
}

export { PageTransition }
