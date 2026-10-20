import Link from "next/link";
import { redirect } from "next/navigation";
import { formatProgress, runStatusLabel } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Список запусків. Які запуски видно, вирішує RLS (run_overview — security_invoker): менеджер — свої й ті, де він
// виконавець; адміністратор — усі (AC-TASK-06). У рядку — назва шаблону, статус і прогрес «N of M done» (AC-TASK-09);
// найновіші вгорі (робочі рішення до solomchaak/property-workflows-spec#10 і коментаря в ньому, #12).
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Runs</h1>
        <Link
          href="/runs/new"
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Launch a template
        </Link>
      </div>
      {runs && runs.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-normal">Case</th>
              <th className="py-2 pr-4 font-normal">Template</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 font-normal">Progress</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} data-testid="run-row" className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/runs/${run.id}`} className="underline">
                    {run.case_name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{run.template_name}</td>
                <td className="py-2 pr-4">{runStatusLabel(run.status ?? "")}</td>
                <td className="py-2" data-testid="run-progress">
                  {formatProgress(run.done_count ?? 0, run.total_count ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-zinc-500">No runs yet.</p>
      )}
      <Link href="/" className="text-sm underline">
        Back to profile
      </Link>
    </main>
  );
}
