"use client";

import "./globals.css";

// Помилка в самому макеті (layout.tsx) — тоді й PageShell недоступний, тож сторінка малює власні <html> і <body>
// (документація Next: global-error). Стилі — ті самі токени з globals.css; тема — за пристроєм (cookie тут не читаємо).
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <title>Something went wrong · Property workflows</title>
        <main role="alert" className="flex max-w-md flex-col gap-3">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">The application could not be loaded. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-11 w-fit rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
