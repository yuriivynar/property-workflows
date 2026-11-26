"use client";

import { RotateCcw } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";

// Несподівана помилка сторінки чи дії — у тому самому макеті (бічна панель лишається), спокійним тоном, без деталей
// помилки (DESIGN.md, «Стани»), а не стандартна сторінка Next (рев'ю 2026-11-26). Сервер уже повідомив про неї
// трекеру (src/instrumentation.ts, onRequestError). «Try again» заново завантажує й малює сегмент (retry, Next 16.3+).
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div role="alert" className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">The page could not be loaded. Try again in a moment.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => retry()} className="max-sm:w-full">
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <BackLink href="/runs">Back to runs</BackLink>
      </div>
    </main>
  );
}
