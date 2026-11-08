import { Skeleton } from "@/components/ui/skeleton";

// Заглушка сторінок шаблону (перегляд, редактор, версії): заголовок і блоки вмісту (для читачів екрана — прихований
// «Loading…»). Вона ж стає запасною для вкладених сторінок, щоб замість неї не показувався список шаблонів.
export default function Loading() {
  return (
    <>
      <p role="status" className="sr-only">Loading…</p>
      <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      </main>
    </>
  );
}
