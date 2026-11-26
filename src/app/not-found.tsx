import { Notice } from "@/components/ui/notice";

// Невідома адреса — той самий макет застосунку, без даних і з посиланням назад (DESIGN.md, «Стани»: «Не знайдено»), а не
// стандартна сторінка Next (рев'ю 2026-11-26). Сторінки з власним «не знайдено» («Run not found», «Template not found»)
// показують свій текст із AC і сюди не потрапляють.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Notice message="Page not found" backHref="/runs" backLabel="Back to runs" />
    </main>
  );
}
