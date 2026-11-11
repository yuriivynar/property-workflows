import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"

// Посилання назад на відмові й «не знайдено» (ADR 0008): текст дослівно з AC («Back to runs», «Back to templates» —
// AC-DSYS-02, AC-VENDOR-08, AC-VENDOR-14, AC-TASK-10), вигляд — кнопка-контур зі стрілкою (стрілка декоративна).
// Лишається посиланням (роль link), а не кнопкою: це перехід на іншу сторінку.
function BackLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} data-slot="back-link" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit gap-2", className)}>
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  )
}

export { BackLink }
