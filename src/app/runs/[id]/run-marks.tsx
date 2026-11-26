"use client";

import { createContext, useContext, useOptimistic } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatusBadge } from "@/components/ui/status-badge";
import { Confetti, useCompletionBurst } from "@/components/ui/confetti";
import { formatProgress, needsConfirmation } from "@/lib/runs/domain";

/** Що потрібно знати про задачу, щоб рахувати прогрес і «останню обов'язкову» в браузері. */
export interface MarkTask {
  id: string;
  section_id: string;
  is_required: boolean;
  status: string;
  is_shown: boolean;
}

type RunMarks = { tasks: readonly MarkTask[]; done: ReadonlySet<string>; markDone: (taskId: string) => void };

const RunMarksContext = createContext<RunMarks | null>(null);

/**
 * Миттєві позначки на рівні всього запуску (ADR 0012, доповнення): позначена задача одразу «done» не лише у своєму
 * рядку, а й у прогресі запуску, прогресі розділу й у тому, яка задача тепер остання обов'язкова (вона одразу просить
 * підтвердження, AC-TASK-04, AC-TASK-16). useOptimistic: якщо сервер відмовив, усе повертається разом із рядком;
 * якщо прийняв — ті самі значення приходять із сервера в тій самій дії.
 */
export function RunMarksProvider({ tasks, children }: { tasks: readonly MarkTask[]; children: React.ReactNode }) {
  const [done, markDone] = useOptimistic<ReadonlySet<string>, string>(new Set(), (current, taskId) => new Set(current).add(taskId));
  return <RunMarksContext value={{ tasks, done, markDone }}>{children}</RunMarksContext>;
}

export function useRunMarks(): RunMarks | null {
  return useContext(RunMarksContext);
}

/** Задачі запуску з урахуванням позначок, які сервер ще не підтвердив. */
export function liveTasks(marks: RunMarks): MarkTask[] {
  return marks.tasks.map((task) => (marks.done.has(task.id) ? { ...task, status: "done" } : task));
}

/** Чи просить задача підтвердження зараз (з урахуванням щойно позначених). Без провайдера — як порахував сервер. */
export function useNeedsConfirmation(taskId: string, fallback: boolean): boolean {
  const marks = useRunMarks();
  return marks ? needsConfirmation(liveTasks(marks), taskId) : fallback;
}

function countShown(tasks: readonly MarkTask[]) {
  const shown = tasks.filter((task) => task.is_shown);
  return { done: shown.filter((task) => task.status === "done").length, total: shown.length, shown };
}

type Summary = { done: number; total: number; status: string };

/** Завершення — коли виконано всі показані обов'язкові (MODIFIED «Завершення запуску»); остаточно вирішує база. */
function allRequiredDone(shown: readonly MarkTask[]): boolean {
  return shown.some((task) => task.is_required) && shown.every((task) => !task.is_required || task.status === "done");
}

/** Підсумок запуску з урахуванням щойно позначених; без провайдера — як порахував сервер. */
function liveSummary(marks: RunMarks | null, server: Summary): Summary {
  if (!marks) return server;
  const { done, total, shown } = countShown(liveTasks(marks));
  return { done, total, status: allRequiredDone(shown) ? "completed" : server.status };
}

/**
 * Кільце, «N of M done» і статус запуску в картці деталей — одразу після позначки (AC-TASK-05). Коли запуск щойно став
 * «completed» — короткий спалах конфеті (рішення власника 2026-11-26, ADR 0012). На телефоні кільце й число менші.
 */
export function LiveRunSummary({ done, total, status }: Summary) {
  const summary = liveSummary(useRunMarks(), { done, total, status });
  const bursts = useCompletionBurst(summary.status === "completed");
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:py-4">
      <ProgressRing done={summary.done} total={summary.total} className="size-14 sm:size-20" />
      <div className="flex flex-col items-start gap-1 sm:gap-1.5">
        <span className="text-lg font-semibold tabular-nums sm:text-xl" data-testid="run-progress">
          {formatProgress(summary.done, summary.total)}
        </span>
        <span data-testid="run-status">
          <StatusBadge status={summary.status} />
        </span>
      </div>
      {bursts > 0 ? <Confetti key={bursts} /> : null}
    </div>
  );
}

/** Прогрес розділу з урахуванням щойно позначених; без провайдера — як порахував сервер. */
function sectionCount(marks: RunMarks | null, sectionId: string, server: { done: number; total: number }) {
  if (!marks) return server;
  return countShown(liveTasks(marks).filter((task) => task.section_id === sectionId));
}

/** «N of M done» розділу — одразу після позначки. */
export function LiveSectionProgress({ sectionId, done, total }: { sectionId: string; done: number; total: number }) {
  const live = sectionCount(useRunMarks(), sectionId, { done, total });
  return (
    <span className="text-sm tabular-nums text-muted-foreground" data-testid="section-progress">
      {formatProgress(live.done, live.total)}
    </span>
  );
}
