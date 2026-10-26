import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatProgress, runsListState } from "@/lib/runs/domain";
import { LABELS } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";

// Список запусків. Які запуски видно, вирішує RLS (run_overview — security_invoker): менеджер — свої й ті, де він
// виконавець; адміністратор — усі (AC-TASK-06). У рядку — назва шаблону, статус і прогрес «N of M done» (AC-TASK-09);
// найновіші вгорі (робочі рішення до solomchaak/property-workflows-spec#10 і коментаря в ньому, #12).
// Таблиця щільна; на вузькому екрані колонка шаблону переходить під назву випадку (DESIGN.md, розділ 4).
export default async function RunsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { data: runs } = await supabase
    .from("run_overview")
    .select("id, case_name, template_name, status, created_at, done_count, total_count")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{LABELS.runsTitle}</h1>
        <Link href="/runs/new" className={buttonVariants({ size: "lg" })}>
          {LABELS.launchTemplate}
        </Link>
      </div>
      {runsListState(runs) === "table" && runs ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{LABELS.columnCase}</TableHead>
              <TableHead className="hidden sm:table-cell">{LABELS.columnTemplate}</TableHead>
              <TableHead>{LABELS.columnStatus}</TableHead>
              <TableHead>{LABELS.columnProgress}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id} data-testid="run-row">
                <TableCell className="py-2">
                  <TextLink href={`/runs/${run.id}`}>{run.case_name}</TextLink>
                  <span className="block text-muted-foreground sm:hidden">{run.template_name}</span>
                </TableCell>
                <TableCell className="hidden py-2 sm:table-cell">{run.template_name}</TableCell>
                <TableCell className="py-2">
                  <StatusBadge status={run.status ?? ""} />
                </TableCell>
                <TableCell className="py-2 tabular-nums" data-testid="run-progress">
                  {formatProgress(run.done_count ?? 0, run.total_count ?? 0)}
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
