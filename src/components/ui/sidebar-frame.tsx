"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { EyeOff, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "cn"
import { SIDEBAR_LABELS, sidebarCookie, toggleSidebar, type SidebarState } from "@/lib/sidebar"

type SidebarContextValue = { state: SidebarState; setState: (next: SidebarState) => void }

const SidebarContext = createContext<SidebarContextValue>({ state: "expanded", setState: () => {} })

/** Поточний стан бічної панелі (без рамки — «expanded»): згорнута смуга показує лише іконки з підказками. */
function useSidebar() {
  return useContext(SidebarContext)
}

/** Чи не друкує людина в поле: тоді Ctrl+B лишаємо полю. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/**
 * Рамка застосунку після входу (рішення власника 2026-11-26, ADR 0012): від lg бічна панель розгорнута (w-60),
 * згорнута до смуги з іконками (w-16) або прихована — тоді в куті лишається кнопка «Show sidebar». Стан — у cookie
 * (сервер малює одразу потрібну ширину), Ctrl+B / ⌘B перемикає розгорнуту й згорнуту. На телефоні — без змін.
 */
function SidebarFrame({
  initial,
  sidebar,
  children,
}: {
  initial: SidebarState
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [state, setStateRaw] = useState<SidebarState>(initial)

  function setState(next: SidebarState) {
    setStateRaw(next)
    document.cookie = sidebarCookie(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey) || isTyping(event.target)) return
      event.preventDefault()
      setStateRaw((current) => {
        const next = toggleSidebar(current)
        document.cookie = sidebarCookie(next)
        return next
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <SidebarContext value={{ state, setState }}>
      <div data-slot="page-shell" className="flex min-h-full flex-1 flex-col lg:flex-row">
        <aside
          data-slot="app-sidebar"
          data-state={state}
          className={cn(
            "group/sidebar bg-hero text-hero-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:gap-8 lg:py-5 lg:transition-[width] lg:duration-(--duration-slow) lg:ease-standard",
            state === "expanded" && "lg:w-60 lg:px-3",
            state === "collapsed" && "lg:w-16 lg:gap-6 lg:px-2",
            state === "hidden" && "lg:hidden"
          )}
        >
          {sidebar}
        </aside>
        {state === "hidden" ? (
          <button
            type="button"
            onClick={() => setState("expanded")}
            aria-label={SIDEBAR_LABELS.show}
            title={`${SIDEBAR_LABELS.show} (Ctrl+B)`}
            className="fixed top-3 left-3 z-30 hidden size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-card outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:flex"
          >
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <div className={cn("flex min-w-0 flex-1 flex-col max-lg:pb-20", state === "hidden" && "lg:pl-12")}>{children}</div>
      </div>
    </SidebarContext>
  )
}

const CONTROL =
  "flex size-8 items-center justify-center rounded-lg text-hero-muted outline-none transition-colors duration-(--duration-fast) hover:bg-hero-hover hover:text-hero-foreground focus-visible:outline-2 focus-visible:outline-hero-foreground"

/** Кнопки бічної панелі (лише від lg): згорнути чи розгорнути й приховати. */
function SidebarControls() {
  const { state, setState } = useSidebar()
  const collapsed = state === "collapsed"
  const toggleLabel = collapsed ? SIDEBAR_LABELS.expand : SIDEBAR_LABELS.collapse
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <div className="hidden items-center gap-0.5 lg:flex lg:group-data-[state=collapsed]/sidebar:flex-col">
      <button
        type="button"
        onClick={() => setState(collapsed ? "expanded" : "collapsed")}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        title={`${toggleLabel} (Ctrl+B)`}
        className={CONTROL}
      >
        <ToggleIcon aria-hidden="true" className="size-4" />
      </button>
      <button type="button" onClick={() => setState("hidden")} aria-label={SIDEBAR_LABELS.hide} title={SIDEBAR_LABELS.hide} className={CONTROL}>
        <EyeOff aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

export { SidebarControls, SidebarFrame, useSidebar }
