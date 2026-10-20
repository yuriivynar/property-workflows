"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorCodeFrom } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Позначка задачі виконаною (openspec/specs/run-progress). Хто може позначати і чи завершено запуск, вирішує функція
// бази mark_task_done; відмова — код NOT_ALLOWED, текст AC-TASK-03 показує сторінка запуску.
export async function markTaskDone(formData: FormData) {
  const runId = String(formData.get("run_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  const runPath = `/runs/${encodeURIComponent(runId)}`;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
  if (error) {
    redirect(`${runPath}?error=${encodeURIComponent(errorCodeFrom(error.message) ?? "UNEXPECTED")}`);
  }

  revalidatePath("/runs");
  revalidatePath(runPath);
  redirect(runPath);
}
