import { cn } from "cn"
import { TextLink } from "@/components/ui/text-link"

// Порожній список: повідомлення й наступна дія замість порожньої таблиці (DESIGN.md, «Стани»; AC-DSYS-04).
// Малюнок — декоративний: сходинки процесу, ті самі, що в марці шапки.
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
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-input bg-card p-10 text-center text-sm",
        className
      )}
    >
      <svg viewBox="0 0 64 48" aria-hidden="true" className="h-12 w-16 text-input">
        <path
          d="M4 42h18V28h18V14h20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 7"
        />
        <circle cx="22" cy="28" r="3.5" className="fill-muted-foreground" />
        <circle cx="40" cy="14" r="3.5" className="fill-muted-foreground" />
      </svg>
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
