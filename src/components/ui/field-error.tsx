"use client"

import { useEffect, useState } from "react"
import { CircleAlert } from "lucide-react"
import { cn } from "cn"

// Помилка поля (ADR 0012, DESIGN.md «Стани»): під полем, після відправлення, з іконкою; поле пов'язане з нею через
// aria-invalid і aria-describedby (їх ставить сторінка). Щойно людина змінила поле, помилка зникає, а aria-invalid
// знімається — текст помилки, як і раніше, дослівно з AC. Без JavaScript помилка просто лишається до відправлення.
function FieldError({ id, fieldId, children, className }: { id: string; fieldId: string; children: React.ReactNode; className?: string }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const field = document.getElementById(fieldId)
    if (!field) return
    const clear = () => {
      field.removeAttribute("aria-invalid")
      field.removeAttribute("aria-describedby")
      setVisible(false)
    }
    field.addEventListener("input", clear, { once: true })
    return () => field.removeEventListener("input", clear)
  }, [fieldId])

  if (!visible) return null
  return (
    <p
      id={id}
      role="alert"
      data-slot="field-error"
      className={cn(
        "flex items-start gap-1.5 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-base)",
        className
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

export { FieldError }
