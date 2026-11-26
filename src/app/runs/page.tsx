import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  caseQueryParam,
  filterRuns,
  formatYourTasks,
  runsListState,
  runDigest,
  runTabParam,
  type RunDigest,
} from "@/lib/runs/domain";
import { RunsToolbar } from "./runs-toolbar";
import { CELL_STACK, ROW_STACK, RunsTable, type RunRow } from "./runs-table";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import { listRunContents, listRuns } from "@/lib/runs/queries";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";


// Список запусків. Які запуски видно, вирішує RLS (run_overview — security_invoker): менеджер — свої й ті, де він
// виконавець; адміністратор — усі (AC-TASK-06). У рядку — назва шаблону, статус і прогрес «N of M done» (AC-TASK-09);
// найновіші вгорі (робочі рішення до solomchaak/property-workflows-spec#10 і коментаря в ньому, #12).
// Таблиця щільна; на вузькому екрані колонка шаблону переходить під назву випадку (DESIGN.md, розділ 4).
// Вендор бачить окремий список (VendorRuns): лише запуски зі своїми задачами (AC-VENDOR-03, AC-VENDOR-10).
export default async function RunsPage({ searchParams }: PageProps<"/runs">) {
  const params = await searchParams;
  const tab = runTabParam(params.status);
  const query = caseQueryParam(params.q);
  const supabase = await createClient();
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }

  if (viewer.role === "vendor") return <VendorRuns />;

  const { data: runs, error: loadError } = await listRuns(supabase);
  const { rows, counts } = filterRuns(runs ?? [], tab, query);
  const { digests, emails } = await loadDigests(supabase, rows);

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
      ) : runsListState(runs) === "table" ? (
        <>
        <RunsToolbar tab={tab} query={query} counts={counts} />
        {rows.length === 0 ? (
          <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-sm" data-testid="runs-no-match">
            <p className="font-medium">{LABELS.noRunsMatch(query)}</p>
            <p className="text-muted-foreground">{LABELS.tryAnotherCaseName}</p>
          </div>
        ) : (
        <RunsTable rows={rows} digests={digests} emails={emails} />
        )}
        </>
      ) : (
        <EmptyState message={LABELS.noRuns} actionHref="/runs/new" actionLabel={LABELS.launchTemplate} />
      )}
    </main>
  );
}

/** Підсумки рядків, що розгортаються: розділи й задачі показаних запусків одним запитом, email — з довідника колег. */
async function loadDigests(supabase: Awaited<ReturnType<typeof createClient>>, rows: readonly RunRow[]) {
  const ids = rows.map((run) => run.id).filter((id): id is string => Boolean(id));
  const digests = new Map<string, RunDigest>();
  if (ids.length === 0) return { digests, emails: new Map<string, string | null>() };
  const [[{ data: sections }, { data: tasks }], { data: staff }] = await Promise.all([
    listRunContents(supabase, ids),
    supabase.rpc("staff_directory"),
  ]);
  for (const id of ids) {
    digests.set(
      id,
      runDigest(
        (sections ?? []).filter((section) => section.run_id === id),
        (tasks ?? []).filter((task) => task.run_id === id),
      ),
    );
  }
  return { digests, emails: new Map((staff ?? []).map((person) => [person.id, person.email])) };
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
              <TableRow key={run.id} data-testid="run-row" className={`${ROW_STACK} relative cursor-pointer`}>
                <TableCell className={`${CELL_STACK} whitespace-normal [overflow-wrap:anywhere]`}>
                  <TextLink href={`/runs/${run.id}`} className="font-medium no-underline after:absolute after:inset-0 hover:underline">
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
    </main>
  );
}
