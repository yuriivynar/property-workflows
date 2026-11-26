"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/require-role";
import { canChangeAnswer, errorCodeFrom, isUuid, messageForError, taskBelongsToRun } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Позначка задачі виконаною (openspec/specs/run-progress). Хто може позначати і чи завершено запуск, вирішує функція
// бази mark_task_done; відмова — код NOT_ALLOWED, текст AC-TASK-03 показує сторінка запуску (markTaskDone) або рядок
// задачі на місці (markTaskDoneInPlace, миттєва позначка UI v3 — ADR 0012).
/** Підсумок позначки: сторінка запуску й код відмови (null — позначено). */
type MarkOutcome = { runPath: string; code: string | null };

/**
 * Спільний початок дій сторінки запуску: вхід (не увійшов — /login) і роль через currentUser() до будь-якого запиту,
 * що пише (AGENTS.md); id запуску з форми — лише UUID (інше — /runs, до запиту до бази).
 */
async function runActionStart(formData: FormData) {
  const runId = String(formData.get("run_id") ?? "");
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok && user.reason === "NOT_SIGNED_IN") {
    redirect("/login");
  }
  if (!isUuid(runId)) {
    redirect("/runs");
  }
  return { supabase, user, runId, runPath: `/runs/${runId}` };
}

type RunActionStart = Awaited<ReturnType<typeof runActionStart>>;

async function performMark(formData: FormData, start: RunActionStart): Promise<MarkOutcome> {
  const taskId = String(formData.get("task_id") ?? "");
  const { supabase, user, runId, runPath } = start;
  // Без профілю з відомою роллю нічого не позначаємо; хто саме може позначити задачу, вирішує mark_task_done.
  if (!user.ok || !isUuid(taskId)) {
    return { runPath, code: "NOT_ALLOWED" };
  }

  // Задача має належати саме запуску з форми: інакше дія виконала б позначку в іншому запуску й повернула б на чужу
  // сторінку. RLS повертає задачу лише тому, хто бачить її запуск.
  const { data: task, error: taskError } = await supabase
    .from("run_tasks")
    .select("run_id")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) {
    return { runPath, code: "UNEXPECTED" };
  }
  if (!taskBelongsToRun(task, runId)) {
    return { runPath, code: "NOT_ALLOWED" };
  }

  // confirmed=true надсилає лише форма підтвердження; останню обов'язкову задачу база без нього не позначить
  // (AC-TASK-04, AC-TASK-16).
  const confirmed = formData.get("confirmed") === "true";
  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId, p_confirmed: confirmed });
  if (error) {
    return { runPath, code: errorCodeFrom(error.message) ?? "UNEXPECTED" };
  }

  revalidatePath("/runs");
  revalidatePath(runPath);
  return { runPath, code: null };
}

export async function markTaskDone(formData: FormData) {
  const { runPath, code } = await performMark(formData, await runActionStart(formData));
  redirect(code ? `${runPath}?error=${encodeURIComponent(code)}` : runPath);
}

/**
 * Та сама позначка без переадресації: відмову (дослівний текст AC) показує рядок задачі на місці. code — щоб рядок
 * відрізнив «потрібне підтвердження» (CONFIRMATION_REQUIRED — показати підтвердження, а не помилку) від інших відмов.
 */
export type InPlaceResult = { error: string | null; code: string | null };

export async function markTaskDoneInPlace(formData: FormData): Promise<InPlaceResult> {
  const { code } = await performMark(formData, await runActionStart(formData));
  return { error: code ? messageForError(code) : null, code };
}

// Відповідь на поле запуску (openspec/specs/conditional-tasks). Роль перевіряємо до запису (AGENTS.md): лише менеджер
// запуску або адміністратор (AC-LOGIC-05); атомарно відповідь, залежні задачі «to do» і статус запуску змінює функція бази
// set_run_field_answer (AC-LOGIC-02, AC-LOGIC-04).
export async function setRunFieldAnswer(formData: FormData) {
  const fieldId = String(formData.get("field_id") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const { supabase, user, runId, runPath } = await runActionStart(formData);
  if (!user.ok || !isUuid(fieldId)) {
    redirect(`${runPath}?error=ANSWER_NOT_ALLOWED`);
  }

  // Поле має належати запуску з форми; менеджер запуску — з runs (RLS: вендор не бачить ні поля, ні запуску).
  const [{ data: field, error: fieldError }, { data: run, error: runError }] = await Promise.all([
    supabase.from("run_fields").select("run_id").eq("id", fieldId).maybeSingle(),
    supabase.from("runs").select("run_manager_id").eq("id", runId).maybeSingle(),
  ]);
  if (fieldError || runError) {
    redirect(`${runPath}?error=UNEXPECTED`);
  }
  if (
    !run ||
    !taskBelongsToRun(field, runId) ||
    !canChangeAnswer({ userId: user.userId, role: user.role, runManagerId: run.run_manager_id })
  ) {
    redirect(`${runPath}?error=ANSWER_NOT_ALLOWED`);
  }

  // Порожня відповідь — null («без відповіді»): функція бази це приймає, а згенеровані типи параметрів функцій Postgres
  // завжди не-null (у параметрів немає позначки nullable), тож тип звужуємо явно.
  const p_answer = (answer || null) as string;
  const { error } = await supabase.rpc("set_run_field_answer", { p_field_id: fieldId, p_answer });
  if (error) {
    redirect(`${runPath}?error=${encodeURIComponent(errorCodeFrom(error.message) ?? "UNEXPECTED")}`);
  }

  revalidatePath("/runs");
  revalidatePath(runPath);
  redirect(runPath);
}
