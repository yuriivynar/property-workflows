import { cn } from "cn"
import { BackLink } from "@/components/ui/back-link"

// Відмова чи «не знайдено» в тому самому макеті сторінки: заголовок-повідомлення, посилання назад, жодних даних
// (DESIGN.md, «Стани»; AC-DSYS-02, AC-EDITOR-07, AC-TASK-10).
function Notice({
  message,
  backHref,
  backLabel,
  className,
}: {
  message: string
  backHref?: string
  backLabel?: string
  className?: string
}) {
  return (
    <div data-slot="notice" role="status" className={cn("flex flex-col gap-4", className)}>
      <h1 className="text-2xl font-semibold">{message}</h1>
      {backHref && backLabel ? (
        <BackLink href={backHref}>{backLabel}</BackLink>
      ) : null}
    </div>
  )
}

export { Notice }
