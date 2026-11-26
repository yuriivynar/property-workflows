"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "cn"
import {
  clampSidebarWidth,
  SIDEBAR_LABELS,
  SIDEBAR_WIDTH,
  sidebarCookie,
  sidebarWidthCookie,
  toggleSidebar,
  type SidebarState,
} from "@/lib/sidebar"

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

/** Клавіші ручки: ← → — крок, Home / End — межі. Інша клавіша — null. */
function widthForKey(key: string, width: number): number | null {
  if (key === "ArrowLeft") return width - SIDEBAR_WIDTH.step
  if (key === "ArrowRight") return width + SIDEBAR_WIDTH.step
  if (key === "Home") return SIDEBAR_WIDTH.min
  if (key === "End") return SIDEBAR_WIDTH.max
  return null
}

/**
 * Ручка на правому краї розгорнутої панелі: потягнути мишею чи пальцем (pointer events) або ← → / Home / End з
 * клавіатури; подвійний клік — типова ширина. Роль separator з aria-valuenow/min/max. Ширина — у cookie після відпускання.
 */
function ResizeHandle({ width, onResize }: { width: number; onResize: (width: number, commit: boolean) => void }) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function stop(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const next = drag.current.startWidth + event.clientX - drag.current.startX
    drag.current = null
    setDragging(false)
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")
    onResize(next, true)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={SIDEBAR_LABELS.resize}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      title={`${SIDEBAR_LABELS.resize} (double-click to reset)`}
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        drag.current = { startX: event.clientX, startWidth: width }
        setDragging(true)
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
      }}
      onPointerMove={(event) => {
        if (drag.current) onResize(drag.current.startWidth + event.clientX - drag.current.startX, false)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onResize(SIDEBAR_WIDTH.default, true)}
      onKeyDown={(event) => {
        const next = widthForKey(event.key, width)
        if (next === null) return
        event.preventDefault()
        onResize(next, true)
      }}
      className="group/handle absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none lg:block"
    >
      {/* Лінія краю: видно при наведенні, перетягуванні й фокусі з клавіатури. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors duration-(--duration-fast) group-hover/handle:bg-hero-border group-focus-visible/handle:bg-hero-foreground group-data-dragging/handle:bg-hero-foreground"
      />
    </div>
  )
}

/**
 * Рамка застосунку після входу (рішення власника 2026-11-26, ADR 0012): від lg бічна панель розгорнута (ширина
 * 200…360 px, змінюється за край) або згорнута до смуги з іконками (w-16). Стан і ширина — у cookie (сервер малює одразу
 * потрібну панель), Ctrl+B / ⌘B перемикає розгорнуту й згорнуту. На телефоні — без змін.
 */
function SidebarFrame({
  initial,
  initialWidth = SIDEBAR_WIDTH.default,
  sidebar,
  children,
}: {
  initial: SidebarState
  initialWidth?: number
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [state, setStateRaw] = useState<SidebarState>(initial)
  const [width, setWidth] = useState(() => clampSidebarWidth(initialWidth))
  const [resizing, setResizing] = useState(false)

  function setState(next: SidebarState) {
    setStateRaw(next)
    document.cookie = sidebarCookie(next)
  }

  function resize(next: number, commit: boolean) {
    const clamped = clampSidebarWidth(next)
    setWidth(clamped)
    setResizing(!commit)
    if (commit) document.cookie = sidebarWidthCookie(clamped)
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

  const expanded = state === "expanded"
  return (
    <SidebarContext value={{ state, setState }}>
      <div data-slot="page-shell" className="flex min-h-full flex-1 flex-col lg:flex-row">
        <aside
          data-slot="app-sidebar"
          data-state={state}
          // Ширина — лише CSS-змінна (не колір); клас lg:w-(--sidebar-width) застосовує її від lg.
          style={expanded ? ({ "--sidebar-width": `${width}px` } as React.CSSProperties) : undefined}
          className={cn(
            "group/sidebar bg-hero text-hero-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:gap-8 lg:py-5",
            !resizing && "lg:transition-[width] lg:duration-(--duration-slow) lg:ease-standard",
            expanded ? "lg:w-(--sidebar-width) lg:px-3" : "lg:w-16 lg:gap-6 lg:px-2"
          )}
        >
          {sidebar}
          {expanded ? <ResizeHandle width={width} onResize={resize} /> : null}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col max-lg:pb-20">{children}</div>
      </div>
    </SidebarContext>
  )
}

/** Кнопка бічної панелі (лише від lg): згорнути чи розгорнути. */
function SidebarControls() {
  const { state, setState } = useSidebar()
  const collapsed = state === "collapsed"
  const label = collapsed ? SIDEBAR_LABELS.expand : SIDEBAR_LABELS.collapse
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <button
      type="button"
      onClick={() => setState(toggleSidebar(state))}
      aria-label={label}
      aria-expanded={!collapsed}
      title={`${label} (Ctrl+B)`}
      className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-hero-muted outline-none transition-colors duration-(--duration-fast) hover:bg-hero-hover hover:text-hero-foreground focus-visible:outline-2 focus-visible:outline-hero-foreground lg:flex"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}

export { SidebarControls, SidebarFrame, useSidebar }
