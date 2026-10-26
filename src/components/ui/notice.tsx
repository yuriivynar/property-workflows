import { cn } from "cn"
import { TextLink } from "@/components/ui/text-link"

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
        <TextLink href={backHref} className="w-fit text-sm">
          {backLabel}
        </TextLink>
      ) : null}
    </div>
  )
}

export { Notice }
