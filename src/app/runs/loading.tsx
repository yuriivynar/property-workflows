import { Skeleton } from "@/components/ui/skeleton";

// Заглушка списку запусків: заголовок і п'ять рядків-карток тієї ж висоти, що й справжні (без слів: сторінка завантажується).
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-11 w-44 sm:h-10" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    </main>
  );
}
