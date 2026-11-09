import { Skeleton } from "@/components/ui/skeleton";

// Заглушка форми запуску: заголовок, вибір шаблону й поля (для читачів екрана — прихований «Loading…»).
export default function Loading() {
  return (
    <>
      <p role="status" className="sr-only">Loading…</p>
      <main aria-busy="true" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Skeleton className="h-8 w-56" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full sm:w-72" />
        <Skeleton className="h-11 w-full sm:w-72" />
        <Skeleton className="h-11 w-40" />
      </div>
      </main>
    </>
  );
}
