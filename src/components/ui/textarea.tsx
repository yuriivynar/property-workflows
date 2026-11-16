import * as React from "react"
import { cn } from "cn"

// shadcn textarea (npx shadcn@4.22.1 add textarea), вирівняне з Input за DESIGN.md: тло card, фокус — межа кольору
// тексту й підсвітка ring-glow, без dark:-класів (тему дають токени).
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-40 w-full rounded-lg border border-input bg-card px-3 py-2 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-glow disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
