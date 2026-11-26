"use client"

import { useEffect, useRef } from "react"
import { CircleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Помилка форми (ADR 0012, DESIGN.md «Стани»): Alert над формою з коротким заголовком і дослівним текстом AC; щойно
// помилка з'явилася, фокус переходить на неї (tabIndex -1), тож читач екрана й клавіатура одразу на ній. Без спливаючих
// вікон; введене лишається у формі.
function FormAlert({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <Alert
      ref={ref}
      id={id}
      variant="destructive"
      tabIndex={-1}
      data-slot="form-alert"
      className="outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in-0 slide-in-from-top-1 duration-(--duration-base)"
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export { FormAlert }
