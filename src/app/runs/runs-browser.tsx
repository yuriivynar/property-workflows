"use client";

import { Fragment, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { filterRuns, RUN_TABS, type RunTab } from "@/lib/runs/domain";
import { LABELS } from "@/lib/runs/messages";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const TAB_LABELS: Record<RunTab, string> = {
  all: LABELS.tabAll,
  in_progress: LABELS.tabInProgress,
  completed: LABELS.tabCompleted,
};

/** Адреса списку з вкладкою й фільтром — порожні параметри не пишемо. */
export function runsHref(tab: RunTab, query: string): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("status", tab);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/runs?${search}` : "/runs";
}

export interface RunItem {
  id: string;
  case_name: string | null;
  status: string | null;
  /** Рядок таблиці, намальований на сервері (RunTableRow). */
  row: React.ReactNode;
}

/**
 * Вкладки «All · In progress · Completed» з лічильниками й фільтр за назвою випадку (рішення власника 2026-11-26,
 * ADR 0012; взято з полотна UI v3). Перемикання й фільтр — у браузері, без запиту до сервера: вкладка — миттєво,
 * фільтр — під час набору із затримкою. Адреса оновлюється (?status=…&q=…) — посиланням можна поділитися; без
 * JavaScript вкладки — звичайні посилання, а фільтр — форма GET, і сервер малює той самий вибір.
 */
export function RunsBrowser({
  initialTab,
  initialQuery,
  items,
}: {
  initialTab: RunTab;
  initialQuery: string;
  items: readonly RunItem[];
}) {
  const [tab, setTab] = useState<RunTab>(initialTab);
  const [text, setText] = useState(initialQuery);
  const query = useDebouncedValue(text.trim());
  const { rows, counts } = filterRuns(items, tab, query);

  useEffect(() => {
    const href = runsHref(tab, query);
    if (`${window.location.pathname}${window.location.search}` !== href) window.history.replaceState(null, "", href);
  }, [tab, query]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={LABELS.filterByStatus} className="flex gap-0.5 rounded-full border border-border bg-muted p-1 sm:gap-1">
          {RUN_TABS.map((option) => (
            <a
              key={option}
              href={runsHref(option, query)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                setTab(option);
              }}
              aria-current={option === tab ? "page" : undefined}
              data-testid={`runs-tab-${option}`}
              className={cn(
                "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap sm:h-9 sm:gap-2 sm:px-3.5 sm:text-sm text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:flex-none",
                option === tab && "bg-card text-foreground shadow-card",
              )}
            >
              {TAB_LABELS[option]}
              <span className="tabular-nums text-muted-foreground">{counts[option]}</span>
            </a>
          ))}
        </nav>
        <form
          method="get"
          action="/runs"
          role="search"
          className="relative"
          onSubmit={(event) => event.preventDefault()}
        >
          {tab !== "all" ? <input type="hidden" name="status" value={tab} /> : null}
          <label htmlFor="runs-filter" className="sr-only">
            {LABELS.filterByCaseName}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="runs-filter"
            name="q"
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={LABELS.filterByCaseName}
            maxLength={100}
            aria-controls="runs-list"
            className="h-11 pl-9 sm:h-9 sm:w-64"
          />
        </form>
      </div>
      {rows.length === 0 ? (
        <div
          id="runs-list"
          role="status"
          className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-sm"
          data-testid="runs-no-match"
        >
          <p className="font-medium">{LABELS.noRunsMatch(query)}</p>
          <p className="text-muted-foreground">{LABELS.tryAnotherCaseName}</p>
        </div>
      ) : (
        <Table id="runs-list">
          <TableHeader className="max-sm:sr-only">
            <TableRow>
              <TableHead>{LABELS.columnCase}</TableHead>
              <TableHead className="hidden sm:table-cell">{LABELS.columnTemplate}</TableHead>
              <TableHead>{LABELS.columnStatus}</TableHead>
              <TableHead>{LABELS.columnProgress}</TableHead>
            </TableRow>
          </TableHeader>
          {/* На телефоні рядок — картка: назва (з шаблоном під нею) і статус зверху, прогрес на всю ширину нижче. */}
          <TableBody>
            {rows.map((item) => (
              <Fragment key={item.id}>{item.row}</Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
