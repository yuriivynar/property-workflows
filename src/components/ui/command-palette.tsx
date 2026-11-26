"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { cn } from "cn"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import type { SearchItem } from "@/app/search/actions"
import { useSidebar } from "@/components/ui/sidebar-frame"

const GROUPS = ["Runs", "Templates", "Actions"] as const

/**
 * Палітра команд ⌘K / Ctrl+K (UI v3, рішення власника 2026-11-26, ADR 0012): запуски, шаблони й дії за роллю. Дані
 * завантажує Server Action лише при відкритті (те, що користувач і так бачить під RLS). Кнопка «Search everything» — у
 * бічній панелі; клавіші працюють на кожній сторінці після входу.
 */
function CommandPalette({ load, tone = "hero" }: { load: () => Promise<SearchItem[]>; tone?: "hero" | "bar" }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SearchItem[] | null>(null)
  const [, startTransition] = useTransition()
  const collapsed = useSidebar().state === "collapsed"

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    void load().then((result) => {
      if (active) setItems(result)
    })
    return () => {
      active = false
    }
  }, [open, load])

  function go(href: string) {
    setOpen(false)
    startTransition(() => router.push(href))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tone === "bar" ? "Search everything" : undefined}
        title={collapsed && tone === "hero" ? "Search everything (Ctrl+K)" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-hero-foreground",
          tone === "hero"
            ? "h-10 w-full border border-hero-border px-3 text-hero-muted hover:bg-hero-hover hover:text-hero-foreground lg:group-data-[state=collapsed]/sidebar:justify-center lg:group-data-[state=collapsed]/sidebar:px-0"
            : "size-11 justify-center text-hero-foreground hover:bg-hero-hover"
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        {tone === "hero" ? (
          <>
            <span className="flex-1 text-left lg:group-data-[state=collapsed]/sidebar:sr-only">Search everything</span>
            <kbd className="rounded border border-hero-border px-1.5 text-xs lg:group-data-[state=collapsed]/sidebar:hidden">⌘K</kbd>
          </>
        ) : null}
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search runs, templates and actions">
        <CommandInput placeholder="Search runs, templates and actions" aria-label="Search runs, templates and actions" />
        <CommandList>
          <CommandEmpty>{items === null ? "Loading…" : "Nothing found"}</CommandEmpty>
          {GROUPS.map((group) => {
            const inGroup = (items ?? []).filter((item) => item.group === group)
            return inGroup.length ? (
              <CommandGroup key={group} heading={group}>
                {inGroup.map((item) => (
                  <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => go(item.href)}>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <CommandShortcut>{item.hint}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null
          })}
        </CommandList>
      </CommandDialog>
    </>
  )
}

export { CommandPalette }
