import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RUN_TABS, type RunTab } from "@/lib/runs/domain";
import { LABELS } from "@/lib/runs/messages";

const TAB_LABELS: Record<RunTab, string> = {
  all: LABELS.tabAll,
  in_progress: LABELS.tabInProgress,
  completed: LABELS.tabCompleted,
};

/** Адреса списку з вкладкою й фільтром — порожні параметри не пишемо. */
function runsHref(tab: RunTab, query: string): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/runs?${search}` : "/runs";
}

/**
 * Вкладки «All · In progress · Completed» з лічильниками й фільтр за назвою випадку (рішення власника 2026-11-26,
 * ADR 0012; взято з полотна UI v3). Обидва — у search params адреси: працюють без JavaScript, посиланням можна
 * поділитися, «Назад» повертає попередній вибір. Поточна вкладка — фоном і aria-current, не акцентом.
 */
export function RunsToolbar({ tab, query, counts }: { tab: RunTab; query: string; counts: Record<RunTab, number> }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label={LABELS.filterByStatus} className="flex gap-1 rounded-full border border-border bg-muted p-1">
        {RUN_TABS.map((option) => (
          <Link
            key={option}
            href={runsHref(option, query)}
            aria-current={option === tab ? "page" : undefined}
            data-testid={`runs-tab-${option}`}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:h-9 sm:flex-none",
              option === tab && "bg-card text-foreground shadow-card",
            )}
          >
            {TAB_LABELS[option]}
            <span className="tabular-nums text-muted-foreground">{counts[option]}</span>
          </Link>
        ))}
      </nav>
      <form method="get" action="/runs" role="search" className="flex gap-2">
        {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
        <label htmlFor="runs-filter" className="sr-only">
          {LABELS.filterByCaseName}
        </label>
        <Input
          id="runs-filter"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={LABELS.filterByCaseName}
          maxLength={100}
          className="h-11 sm:h-9 sm:w-64"
        />
        <Button type="submit" variant="outline" className="h-11 sm:h-9" aria-label={LABELS.applyFilter}>
          <Search aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
