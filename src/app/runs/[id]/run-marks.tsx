"use client";

import { createContext, useContext, useOptimistic } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatusBadge } from "@/components/ui/status-badge";
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

/** Кільце, «N of M done» і статус запуску в картці деталей — одразу після позначки (AC-TASK-05). */
export function LiveRunSummary({ done, total, status }: { done: number; total: number; status: string }) {
  const marks = useRunMarks();
  const live = marks ? countShown(liveTasks(marks)) : null;
  const shownDone = live?.done ?? done;
  const shownTotal = live?.total ?? total;
  // Завершення — коли виконано всі показані обов'язкові (MODIFIED «Завершення запуску»); остаточно вирішує база.
  const completes = live ? live.shown.some((task) => task.is_required) && live.shown.every((task) => !task.is_required || task.status === "done") : false;
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <ProgressRing done={shownDone} total={shownTotal} />
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-xl font-semibold tabular-nums" data-testid="run-progress">
          {formatProgress(shownDone, shownTotal)}
        </span>
        <span data-testid="run-status">
          <StatusBadge status={completes ? "completed" : status} />
        </span>
      </div>
    </div>
  );
}

/** «N of M done» розділу — одразу після позначки. */
export function LiveSectionProgress({ sectionId, done, total }: { sectionId: string; done: number; total: number }) {
  const marks = useRunMarks();
  const live = marks ? countShown(liveTasks(marks).filter((task) => task.section_id === sectionId)) : null;
  return (
    <span className="text-sm tabular-nums text-muted-foreground" data-testid="section-progress">
      {formatProgress(live?.done ?? done, live?.total ?? total)}
    </span>
  );
}
