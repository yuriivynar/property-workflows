import { Skeleton } from "@/components/ui/skeleton";

// Заглушка списку шаблонів: заголовок і рядки таблиці (без слів: сторінка завантажується).
export default function Loading() {
  return (
    <>
      <p role="status" className="sr-only">Loading…</p>
      <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
      </main>
    </>
  );
}
