import { Skeleton } from "@/components/ui/skeleton";

// Заглушка Profile і сторінок без власної loading.tsx: заголовок і блоки (без слів: сторінка завантажується; ADR 0012).
export default function Loading() {
  return (
    <>
      <p role="status" className="sr-only">Loading…</p>
      <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-24" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-20" />
      </main>
    </>
  );
}
