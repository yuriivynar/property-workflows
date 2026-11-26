"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { LABELS } from "@/lib/runs/messages";

/**
 * Рядок списку запусків, що розгортається (UI v3, рішення власника 2026-11-26, ADR 0012): кнопка зі стрілкою в першій
 * клітинці відкриває під рядком прогрес розділів і наступну задачу. Сам рядок лишається посиланням на запуск; кнопка —
 * над розтягнутим посиланням (z-10), aria-expanded + aria-controls; стрілка повертається за --duration-base.
 */
export function ExpandableRunRow({
  caseName,
  caseCell,
  cells,
  detail,
  rowClassName,
  caseCellClassName,
  columns,
}: {
  caseName: string;
  caseCell: React.ReactNode;
  cells: React.ReactNode;
  detail: React.ReactNode;
  rowClassName: string;
  caseCellClassName: string;
  columns: number;
}) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <>
      <TableRow data-testid="run-row" className={rowClassName}>
        <TableCell className={caseCellClassName}>
          <span className="flex items-start gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              aria-label={open ? LABELS.hideSectionsOf(caseName) : LABELS.showSectionsOf(caseName)}
              onClick={() => setOpen((value) => !value)}
              className="relative z-10 -my-1 -ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:size-11"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn("size-4 transition-transform duration-(--duration-base) ease-standard", open && "rotate-90")}
              />
            </button>
            <span className="min-w-0">{caseCell}</span>
          </span>
        </TableCell>
        {cells}
      </TableRow>
      <TableRow
        id={detailId}
        hidden={!open}
        data-testid="run-row-detail"
        className={cn("bg-muted hover:bg-muted", open ? "max-sm:block" : "hidden")}
      >
        <TableCell colSpan={columns} className="px-4 py-3 whitespace-normal max-sm:block">
          {detail}
        </TableCell>
      </TableRow>
    </>
  );
}
