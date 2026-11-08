import { Skeleton } from "@/components/ui/skeleton";

// Заглушка сторінки запуску: заголовок, картка підсумку й блок задач (без слів: сторінка завантажується).
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40" />
    </main>
  );
}
