"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorCodeFrom, isUuid, taskBelongsToRun } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Позначка задачі виконаною (openspec/specs/run-progress). Хто може позначати і чи завершено запуск, вирішує функція
// бази mark_task_done; відмова — код NOT_ALLOWED, текст AC-TASK-03 показує сторінка запуску.
export async function markTaskDone(formData: FormData) {
  const runId = String(formData.get("run_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  // Ідентифікатори з форми — лише UUID: інше відкидаємо до запиту до бази.
  if (!isUuid(runId)) {
    redirect("/runs");
  }
  const runPath = `/runs/${runId}`;
  if (!isUuid(taskId)) {
    redirect(`${runPath}?error=NOT_ALLOWED`);
  }

  // Задача має належати саме запуску з форми: інакше дія виконала б позначку в іншому запуску й повернула б на чужу
  // сторінку. RLS повертає задачу лише тому, хто бачить її запуск.
  const { data: task } = await supabase.from("run_tasks").select("run_id").eq("id", taskId).maybeSingle();
  if (!taskBelongsToRun(task, runId)) {
    redirect(`${runPath}?error=NOT_ALLOWED`);
  }

  // confirmed=true надсилає лише форма підтвердження; останню обов'язкову задачу база без нього не позначить
  // (AC-TASK-04, AC-TASK-16).
  const confirmed = formData.get("confirmed") === "true";
  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId, p_confirmed: confirmed });
  if (error) {
    redirect(`${runPath}?error=${encodeURIComponent(errorCodeFrom(error.message) ?? "UNEXPECTED")}`);
  }

  revalidatePath("/runs");
  revalidatePath(runPath);
  redirect(runPath);
}
