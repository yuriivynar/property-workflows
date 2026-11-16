"use client"

import type { ComponentProps } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type PendingButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  /** Стан відправлення, коли форма надсилається не через `<form action>` (onSubmit + startTransition). */
  pending?: boolean
}

/**
 * Кнопка відправлення форми зі станом «йде відправлення» (DESIGN.md, розділ 6): неактивна, `aria-busy`, іконка, що
 * обертається, перед незмінним текстом дії. Стан бере з `useFormStatus` форми, у якій стоїть, або з `pending`.
 * `prefers-reduced-motion` зупиняє обертання (іконка лишається).
 */
function PendingButton({ pending, disabled, children, ...props }: PendingButtonProps) {
  const status = useFormStatus()
  const busy = pending ?? status.pending
  return (
    <Button type="submit" disabled={busy || disabled} aria-busy={busy || undefined} {...props}>
      {busy ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </Button>
  )
}

export { PendingButton }
