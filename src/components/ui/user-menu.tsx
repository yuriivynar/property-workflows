"use client"

import Link from "next/link"
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react"
import { cn } from "cn"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeChoice, THEME_ICONS, themeOptionName, useThemeChoice } from "@/components/ui/theme-choice"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { THEMES, type Theme } from "@/lib/theme"

/** Ініціали власного email для аватара: «manager.a@example.test» → «MA». Чужих фото й ініціалів не показуємо. */
function initialsOf(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? ""
  const parts = local.split(/[._\-+]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return letters.toUpperCase() || "?"
}

/** Аватар — нейтральний, не акцентний: бірюзовий лише для головної дії екрана (ADR 0012). */
function OwnAvatar({ email, src, className }: { email: string | null | undefined; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      {src ? <AvatarImage src={src} alt="Your photo" /> : null}
      <AvatarFallback className="bg-hero-border text-xs font-semibold text-hero-foreground">{initialsOf(email)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Меню користувача внизу бічної панелі (ADR 0012, варіант A полотна ThemeOptions): кнопка з аватаром, email і роллю →
 * рядок «Theme» з трьома радіо лише з іконкою (ім'я й підказка «Theme: System» тощо), далі Profile і Sign out.
 */
function UserMenu({
  email,
  role,
  theme,
  signOut,
  avatarSrc,
}: {
  email: string | null | undefined
  role: string | null | undefined
  /** Власне фото (/api/avatar) — лише своє; інших людей показуємо лише email (ADR 0012). */
  avatarSrc?: string | null
  theme: Theme
  signOut: () => Promise<void>
}) {
  const [current, choose] = useThemeChoice(theme)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="user-menu"
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-hero-hover focus-visible:outline-2 focus-visible:outline-hero-foreground data-popup-open:bg-hero-hover"
      >
        <OwnAvatar email={email} src={avatarSrc} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-hero-foreground">{email}</span>
          {role ? <span className="text-hero-muted">{role}</span> : null}
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-hero-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-60">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => choose(value as Theme)}
          className="flex items-center justify-between gap-2 px-1.5 py-1"
        >
          <DropdownMenuLabel className="px-0 text-sm font-medium text-foreground">Theme</DropdownMenuLabel>
          <span className="flex gap-1 rounded-full bg-muted p-1">
            {THEMES.map((option) => {
              const Icon = THEME_ICONS[option]
              return (
                <Tooltip key={option}>
                  <TooltipTrigger
                    render={
                      <DropdownMenuRadioItem
                        value={option}
                        closeOnClick={false}
                        aria-label={themeOptionName(option)}
                        className="size-9 justify-center rounded-full px-0! py-0! text-muted-foreground data-checked:bg-card data-checked:text-foreground data-checked:shadow-card [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
                      />
                    }
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>{themeOptionName(option)}</TooltipContent>
                </Tooltip>
              )
            })}
          </span>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/" />}>
            <UserRound aria-hidden="true" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Телефон: аватар у верхній смузі → Sheet з темою й Sign out; Profile — у нижніх вкладках (ADR 0012). */
function UserSheet({
  email,
  role,
  theme,
  signOut,
  avatarSrc,
}: {
  email: string | null | undefined
  role: string | null | undefined
  /** Власне фото (/api/avatar) — лише своє; інших людей показуємо лише email (ADR 0012). */
  avatarSrc?: string | null
  theme: Theme
  signOut: () => Promise<void>
}) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label="Account and theme"
        className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-hero-foreground"
      >
        <OwnAvatar email={email} src={avatarSrc} />
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-5 rounded-t-2xl px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetTitle className="sr-only">Account and theme</SheetTitle>
        <SheetDescription className="sr-only">{email}</SheetDescription>
        <div className="flex items-center gap-3">
          <OwnAvatar email={email} src={avatarSrc} className="size-10" />
          <span className="flex min-w-0 flex-col text-sm">
            <span className="truncate font-medium text-foreground">{email}</span>
            {role ? <span className="text-muted-foreground">{role}</span> : null}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Theme</span>
          <ThemeChoice value={theme} name="theme-sheet" />
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-11 w-full">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { initialsOf, OwnAvatar, UserMenu, UserSheet }
