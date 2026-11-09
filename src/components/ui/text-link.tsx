import Link from "next/link"
import { cn } from "cn"

// Текстове посилання застосунку (навігація «Back to …», назва випадку в таблиці): один вигляд на всіх сторінках.
// Колір — foreground, а не primary: акцент належить лише головній дії екрана (DESIGN.md, розділ 1).
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="text-link"
      className={cn(
        "rounded-sm text-foreground underline decoration-input underline-offset-4 outline-none transition-[text-decoration-color] hover:decoration-foreground hover:decoration-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    />
  )
}

export { TextLink }
