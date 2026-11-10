import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatProgress, formatYourTasks, runsListState } from "@/lib/runs/domain";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import { signedInViewer } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

// Рядок таблиці на телефоні стає карткою (сітка з двох колонок), а клітинки — її частинами (ADR 0007).
const ROW_STACK =
  "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3";
// Довга назва без пробілів (до 100 символів) переноситься всередині слова, а не перекриває статус чи розсуває екран.
const CELL_STACK = "py-2.5 max-sm:p-0 max-sm:whitespace-normal max-sm:[overflow-wrap:anywhere]";

// Список запусків. Які запуски видно, вирішує RLS (run_overview — security_invoker): менеджер — свої й ті, де він
// виконавець; адміністратор — усі (AC-TASK-06). У рядку — назва шаблону, статус і прогрес «N of M done» (AC-TASK-09);
// найновіші вгорі (робочі рішення до solomchaak/property-workflows-spec#10 і коментаря в ньому, #12).
// Таблиця щільна; на вузькому екрані колонка шаблону переходить під назву випадку (DESIGN.md, розділ 4).
// Вендор бачить окремий список (VendorRuns): лише запуски зі своїми задачами (AC-VENDOR-03, AC-VENDOR-10).
export default async function RunsPage() {
  const supabase = await createClient();
  const viewer = await signedInViewer(supabase);
  if (!viewer) {
    redirect("/login");
  }

  if (viewer.role === "vendor") return <VendorRuns />;

  const { data: runs, error: loadError } = await supabase
    .from("run_overview")
    .select("id, case_name, template_name, status, created_at, done_count, total_count")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{LABELS.runsTitle}</h1>
        <Link data-slot="button" href="/runs/new" className={buttonVariants({ size: "lg", className: "max-sm:w-full" })}>
          {LABELS.launchTemplate}
        </Link>
      </div>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{MESSAGES.unexpected}</AlertDescription>
        </Alert>
      ) : runsListState(runs) === "table" && runs ? (
        <Table>
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
            {runs.map((run) => (
              <TableRow key={run.id} data-testid="run-row" className={ROW_STACK}>
                <TableCell className={CELL_STACK}>
                  <TextLink href={`/runs/${run.id}`} className="font-medium">
                    {run.case_name}
                  </TextLink>
                  <span className="block text-muted-foreground sm:hidden">{run.template_name}</span>
                </TableCell>
                <TableCell className="hidden py-2.5 text-muted-foreground sm:table-cell">{run.template_name}</TableCell>
                <TableCell className={CELL_STACK}>
                  <StatusBadge status={run.status ?? ""} />
                </TableCell>
                <TableCell className={`${CELL_STACK} tabular-nums max-sm:col-span-2`} data-testid="run-progress">
                  <span className="flex items-center gap-3">
                    <ProgressBar
                      done={run.done_count ?? 0}
                      total={run.total_count ?? 0}
                      className="max-sm:w-auto max-sm:flex-1"
                    />
                    <span className="font-medium">{formatProgress(run.done_count ?? 0, run.total_count ?? 0)}</span>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState message={LABELS.noRuns} actionHref="/runs/new" actionLabel={LABELS.launchTemplate} />
      )}
      <TextLink href="/" className="w-fit text-sm">
        {LABELS.backToProfile}
      </TextLink>
    </main>
  );
}

/**
 * Список запусків вендора: лише запуски, де він виконавець, — назва випадку, статус запуску й «Your tasks: N of K done»;
 * без назви шаблону й прогресу всього запуску (AC-VENDOR-03; робоче рішення до solomchaak/property-workflows-spec#42).
 * Без задач — «No tasks assigned to you yet.» без порожньої таблиці й без «Launch a template»: вендор не запускає
 * шаблонів (AC-VENDOR-10). Дані — лише з функції бази vendor_runs (рядків runs вендору RLS не віддає).
 */
async function VendorRuns() {
  const supabase = await createClient();
  const { data: runs, error: loadError } = await supabase.rpc("vendor_runs");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">{LABELS.runsTitle}</h1>
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{MESSAGES.unexpected}</AlertDescription>
        </Alert>
      ) : runsListState(runs) === "table" && runs ? (
        <Table>
          <TableHeader className="max-sm:sr-only">
            <TableRow>
              <TableHead>{LABELS.columnCase}</TableHead>
              <TableHead>{LABELS.columnStatus}</TableHead>
              <TableHead>{LABELS.columnYourTasks}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id} data-testid="run-row" className={ROW_STACK}>
                <TableCell className={CELL_STACK}>
                  <TextLink href={`/runs/${run.id}`} className="font-medium">
                    {run.case_name}
                  </TextLink>
                </TableCell>
                <TableCell className={CELL_STACK}>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell className={`${CELL_STACK} tabular-nums max-sm:col-span-2`} data-testid="your-tasks">
                  {formatYourTasks(run.my_done, run.my_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState message={MESSAGES.noVendorTasks} />
      )}
      <TextLink href="/" className="w-fit text-sm">
        {LABELS.backToProfile}
      </TextLink>
    </main>
  );
}
