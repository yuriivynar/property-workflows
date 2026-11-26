import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableCell } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { formatProgress, type RunDigest } from "@/lib/runs/domain";
import { LABELS } from "@/lib/runs/messages";
import { ExpandableRunRow } from "./expandable-run-row";

// Рядок таблиці на телефоні стає карткою (сітка з двох колонок), а клітинки — її частинами (ADR 0007).
export const ROW_STACK =
  "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3";
// Довга назва без пробілів (до 100 символів) переноситься всередині слова, а не перекриває статус чи розсуває екран.
export const CELL_STACK = "py-2.5 max-sm:p-0 max-sm:whitespace-normal max-sm:[overflow-wrap:anywhere]";

export interface RunRow {
  id: string | null;
  case_name: string | null;
  template_name: string | null;
  status: string | null;
  done_count: number | null;
  total_count: number | null;
}

/** Що видно в розгорнутому рядку: прогрес кожного розділу й наступна задача з виконавцем (лише email, AC-TASK-11). */
function RunRowDetail({ digest, emails }: { digest: RunDigest | undefined; emails: Map<string, string | null> }) {
  if (!digest) return null;
  const next = digest.next;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {digest.sections.map((section) => (
          <li key={section.name} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate">{section.name}</span>
            <ProgressBar done={section.done} total={section.total} className="w-16" />
            <span className="tabular-nums text-muted-foreground">{formatProgress(section.done, section.total)}</span>
          </li>
        ))}
      </ul>
      <p className="[overflow-wrap:anywhere]">
        <span className="text-muted-foreground">{LABELS.next}: </span>
        {next ? (
          <>
            <span className="font-medium">{next.isRequired ? next.name : LABELS.optionalSuffix(next.name)}</span>
            <span className="text-muted-foreground"> · {emails.get(next.assigneeId) ?? "—"}</span>
          </>
        ) : (
          <span className="font-medium">{LABELS.nothingLeft}</span>
        )}
      </p>
    </div>
  );
}

/**
 * Рядок списку запусків менеджера й адміністратора: назва випадку (з шаблоном під нею на телефоні), шаблон, статус,
 * прогрес «N of M done» (AC-TASK-09, AC-TASK-13, AC-TASK-14); розгортається (рішення власника 2026-11-26). Таблицю з
 * вкладками й фільтром малює RunsBrowser.
 */
export function RunTableRow({
  run,
  digest,
  emails,
}: {
  run: RunRow;
  digest: RunDigest | undefined;
  emails: Map<string, string | null>;
}) {
  return (
    <ExpandableRunRow
      caseName={run.case_name ?? ""}
      columns={4}
      rowClassName={`${ROW_STACK} relative cursor-pointer`}
      caseCellClassName={`${CELL_STACK} whitespace-normal [overflow-wrap:anywhere]`}
      caseCell={
        <>
          <TextLink href={`/runs/${run.id}`} className="font-medium no-underline after:absolute after:inset-0 hover:underline">
            {run.case_name}
          </TextLink>
          <span className="block text-muted-foreground sm:hidden">{run.template_name}</span>
        </>
      }
      cells={
        <>
          <TableCell className="hidden py-2.5 whitespace-normal [overflow-wrap:anywhere] text-muted-foreground sm:table-cell">
            {run.template_name}
          </TableCell>
          <TableCell className={CELL_STACK}>
            <StatusBadge status={run.status ?? ""} />
          </TableCell>
          <TableCell className={`${CELL_STACK} tabular-nums max-sm:col-span-2`} data-testid="run-progress">
            <span className="flex items-center gap-3">
              <ProgressBar done={run.done_count ?? 0} total={run.total_count ?? 0} className="max-sm:w-auto max-sm:flex-1" />
              <span className="font-medium">{formatProgress(run.done_count ?? 0, run.total_count ?? 0)}</span>
            </span>
          </TableCell>
        </>
      }
      detail={<RunRowDetail digest={digest} emails={emails} />}
    />
  );
}
