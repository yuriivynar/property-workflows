import { cn } from "cn"

// Заглушка на час завантаження сторінки (loading.tsx): без слів і кольору-статусу, лише форма майбутнього вмісту.
function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" data-slot="skeleton" className={cn("animate-shimmer rounded-lg bg-muted", className)} />
}

export { Skeleton }
