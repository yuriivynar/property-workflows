import { cn } from "cn"
import { TextLink } from "@/components/ui/text-link"

// Порожній список: повідомлення й наступна дія замість порожньої таблиці (DESIGN.md, «Стани»; AC-DSYS-04).
function EmptyState({
  message,
  actionHref,
  actionLabel,
  className,
}: {
  message: string
  actionHref?: string
  actionLabel?: string
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col gap-2 rounded-lg border border-dashed border-border p-6 text-sm", className)}
    >
      <p className="text-muted-foreground">{message}</p>
      {actionHref && actionLabel ? (
        <TextLink href={actionHref} className="w-fit">
          {actionLabel}
        </TextLink>
      ) : null}
    </div>
  )
}

export { EmptyState }
