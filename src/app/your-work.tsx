import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { TextLink } from "@/components/ui/text-link";
import type { Viewer } from "@/lib/auth/viewer";
import { needsConfirmation } from "@/lib/runs/domain";
import type { createClient } from "@/lib/supabase/server";
import { NextTaskRow } from "./next-task-row";

type Client = Awaited<ReturnType<typeof createClient>>;
const NEXT_TASKS = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Початок останніх 7 днів — для «Done this week». */
function weekAgoIso(): string {
  return new Date(Date.now() - WEEK_MS).toISOString();
}

/** Назви запусків і чи потребує задача підтвердження: вендору — з його функцій бази, іншим — з RLS-читань. */
async function runContext(supabase: Client, viewer: Viewer, runIds: string[]) {
  const names = new Map<string, string>();
  const confirm = new Map<string, boolean>();
  if (runIds.length === 0) return { names, confirm };
  if (viewer.role === "vendor") {
    const { data: runs } = await supabase.rpc("vendor_runs");
    for (const run of runs ?? []) names.set(run.id, run.case_name);
    const lists = await Promise.all(runIds.map((id) => supabase.rpc("vendor_run_tasks", { p_run_id: id })));
    for (const { data } of lists) for (const task of data ?? []) confirm.set(task.id, task.needs_confirmation);
    return { names, confirm };
  }
  const [{ data: runs }, { data: tasks }] = await Promise.all([
    supabase.from("run_overview").select("id, case_name").in("id", runIds),
    supabase.from("run_tasks").select("id, run_id, is_required, status, is_shown").in("run_id", runIds),
  ]);
  for (const run of runs ?? []) if (run.id) names.set(run.id, run.case_name ?? "");
  for (const task of tasks ?? []) {
    confirm.set(task.id, needsConfirmation((tasks ?? []).filter((other) => other.run_id === task.run_id), task.id));
  }
  return { names, confirm };
}

/**
 * «Your work» на Profile (UI v3, рішення власника 2026-11-26, ADR 0012; поза вимогами PM): лічильники «Tasks to do»,
 * «Done this week», «Runs you manage» (крім вендора) і до 5 наступних власних показаних задач «to do» з позначкою на
 * місці. Дані — під RLS того, хто дивиться; «Done this week» — з журналу run_events (власні позначки).
 */
export async function YourWork({ supabase, viewer }: { supabase: Client; viewer: Viewer }) {
  const since = weekAgoIso();
  const [{ data: tasks }, { count: doneThisWeek }, { count: managed }] = await Promise.all([
    supabase
      .from("run_tasks")
      .select("id, run_id, name, status, is_shown, position")
      .eq("assignee_id", viewer.userId)
      .eq("status", "to_do")
      .eq("is_shown", true)
      .order("position"),
    supabase
      .from("run_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", viewer.userId)
      .eq("kind", "task_done")
      .gte("created_at", since),
    viewer.role === "vendor"
      ? Promise.resolve({ count: null })
      : supabase.from("run_overview").select("id", { count: "exact", head: true }).eq("run_manager_id", viewer.userId),
  ]);
  const toDo = tasks ?? [];
  const next = toDo.slice(0, NEXT_TASKS);
  const { names, confirm } = await runContext(supabase, viewer, [...new Set(next.map((task) => task.run_id))]);
  const tiles = [
    { label: "Tasks to do", value: toDo.length },
    { label: "Done this week", value: doneThisWeek ?? 0 },
    ...(viewer.role === "vendor" ? [] : [{ label: "Runs you manage", value: managed ?? 0 }]),
  ];

  return (
    <section aria-labelledby="your-work" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="your-work" className="text-base font-semibold">
          Your work
        </h2>
        <TextLink href="/runs" className="text-sm text-muted-foreground no-underline hover:underline">
          All runs
        </TextLink>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label} data-testid="work-tile">
            <Card className="gap-1 px-4 py-3">
              <CountUp value={tile.value} className="text-2xl font-semibold tabular-nums" />
              <span className="text-sm text-muted-foreground">{tile.label}</span>
            </Card>
          </li>
        ))}
      </ul>
      <h3 className="mt-2 text-sm font-semibold">Your next tasks</h3>
      <Card className="gap-0 py-0">
        {next.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">Nothing waiting for you. Good work.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {next.map((task) => (
              <NextTaskRow
                key={task.id}
                runId={task.run_id}
                taskId={task.id}
                name={task.name}
                caseName={names.get(task.run_id) ?? ""}
                confirm={confirm.get(task.id) ?? false}
              />
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
