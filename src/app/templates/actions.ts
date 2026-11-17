"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-role";
import { isUuid } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";
import { cleanName, templateErrorCode } from "@/lib/templates/domain";

// Дії редактора шаблону. Кожна — публічний POST-ендпойнт, тому ПЕРШИМ кроком requireAdmin(): getClaims() + роль з
// profiles до будь-якого запису (AC-EDITOR-08). Запис — клієнтом користувача: RLS і колонкові GRANT — друга лінія.
// Кожна зміна пишеться одразу — це й є автозбереження незбережених змін (AC-EDITOR-01).

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Результат дії для клієнтської форми: успіх або код помилки (тексти — messageForTemplateError). */
type InlineResult = { ok: true } | { ok: false; code: string };

const editPath = (templateId: string) => `/templates/${templateId}/edit`;
// Ідентифікатори з форми — лише UUID; інше — як відсутнє значення (дія поверне на список шаблонів без запису).
const id = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && isUuid(value) ? value : null;
};

/** Перевірка адміністратора; інакше — на сторінку, яка покаже «Not enough rights» (і нічого не записано). */
async function adminClient(back: string): Promise<Supabase> {
  const supabase = await createClient();
  const check = await requireAdmin(supabase);
  if (!check.ok) {
    redirect(check.reason === "NOT_SIGNED_IN" ? "/login" : `${back}?error=NOT_ALLOWED`);
  }
  return supabase;
}

function done(templateId: string, error?: { message?: string; code?: string } | null): never {
  revalidatePath(editPath(templateId));
  revalidatePath("/templates");
  redirect(error ? `${editPath(templateId)}?error=${templateErrorCode(error)}` : editPath(templateId));
}

/**
 * Завершення зміни одного елемента шаблону. Запис фільтрується за id елемента І за template_id з форми та повертає
 * змінені рядки: 0 рядків без помилки (елемента вже немає — стара вкладка; або id з іншого шаблону) — це «зміну не
 * збережено», а не тихий успіх (AC-EDITOR-25, рев'ю WS7 №2). Текст — messageForTemplateError → changeNotKept.
 */
function doneChanged(
  templateId: string,
  result: { data: unknown[] | null; error: { message?: string; code?: string } | null },
): never {
  if (!result.error && !result.data?.length) {
    revalidatePath(editPath(templateId));
    redirect(`${editPath(templateId)}?error=CHANGE_NOT_KEPT`);
  }
  done(templateId, result.error);
}

export async function createTemplate(form: FormData) {
  const supabase = await adminClient("/templates");
  const name = cleanName(form.get("name"));
  if (!name) redirect("/templates?error=TEMPLATE_NAME_REQUIRED"); // AC-EDITOR-19
  const { data, error } = await supabase.from("templates").insert({ name }).select("id").single();
  if (error || !data) redirect(`/templates?error=${templateErrorCode(error)}`);
  revalidatePath("/templates");
  redirect(editPath(data.id));
}

// Перейменування — у робочу назву (template_draft_names): менеджер бачить нову назву лише з новою версією, а зайнята
// назва відхиляється під час збереження (AC-EDITOR-21, AC-EDITOR-24).
export async function renameTemplate(form: FormData) {
  const templateId = id(form, "template_id");
  if (!templateId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const name = cleanName(form.get("name"));
  if (!name) redirect(`${editPath(templateId)}?error=TEMPLATE_NAME_REQUIRED`);
  // Один upsert замість «update, а якщо рядків немає — insert»: подвійний клік чи дві вкладки не дають двох вставок
  // з однаковим template_id (помилка унікальності). Права на це — колонковий grant update (template_id), міграція
  // 20261117094426_template_editor_atomic_adds.sql.
  const { error } = await supabase
    .from("template_draft_names")
    .upsert({ template_id: templateId, name }, { onConflict: "template_id" });
  done(templateId, error);
}

export async function addSection(form: FormData) {
  const templateId = id(form, "template_id");
  if (!templateId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const name = cleanName(form.get("name"));
  if (!name) redirect(`${editPath(templateId)}?error=NAME_REQUIRED`);
  // Позицію (max + 1) рахує база в тій самій транзакції, що й вставка, під блокуванням рядка шаблону.
  const { error } = await supabase.rpc("add_template_section", { p_template_id: templateId, p_name: name });
  done(templateId, error);
}

export async function renameSection(form: FormData) {
  const templateId = id(form, "template_id");
  const sectionId = id(form, "section_id");
  if (!templateId || !sectionId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  // Очищена назва лишається в незбережених змінах; зберегти версію з нею не можна (AC-EDITOR-20).
  const name = cleanName(form.get("name")) ?? "";
  const result = await supabase
    .from("template_sections")
    .update({ name })
    .eq("id", sectionId)
    .eq("template_id", templateId)
    .select("id");
  doneChanged(templateId, result);
}

export async function removeSection(form: FormData) {
  const templateId = id(form, "template_id");
  const sectionId = id(form, "section_id");
  if (!templateId || !sectionId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  // Без підтвердження (зокрема прямий POST) нічого не видаляємо (AC-EDITOR-13).
  if (form.get("confirmed") !== "true") redirect(editPath(templateId));
  const result = await supabase
    .from("template_sections")
    .delete()
    .eq("id", sectionId)
    .eq("template_id", templateId)
    .select("id");
  doneChanged(templateId, result);
}

/**
 * Додавання задачі з клієнтської форми редактора: результат — значенням, без redirect, щоб форма показала невдачу на
 * тому самому місці й лишила назву в полі (AC-EDITOR-25). Роль — першим кроком, як у кожній дії (AC-EDITOR-08).
 */
export async function addTaskInline(form: FormData): Promise<InlineResult> {
  const supabase = await createClient();
  const check = await requireAdmin(supabase);
  if (!check.ok) return { ok: false, code: check.reason };
  const templateId = id(form, "template_id");
  const sectionId = id(form, "section_id");
  if (!templateId || !sectionId) return { ok: false, code: "TEMPLATE_NOT_FOUND" };
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, code: "NAME_REQUIRED" };
  const { error } = await supabase.rpc("add_template_task", {
    p_template_id: templateId,
    p_section_id: sectionId,
    p_name: name,
    p_is_required: form.get("is_required") === "on",
  });
  if (error) return { ok: false, code: templateErrorCode(error) };
  revalidatePath(editPath(templateId));
  revalidatePath("/templates");
  return { ok: true };
}

export async function renameTask(form: FormData) {
  const templateId = id(form, "template_id");
  const taskId = id(form, "task_id");
  if (!templateId || !taskId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  // Очищена назва лишається в незбережених змінах; зберегти версію з нею не можна (AC-EDITOR-20).
  const name = cleanName(form.get("name")) ?? "";
  const result = await supabase
    .from("template_tasks")
    .update({ name })
    .eq("id", taskId)
    .eq("template_id", templateId)
    .select("id");
  doneChanged(templateId, result);
}

export async function setTaskRequired(form: FormData) {
  const templateId = id(form, "template_id");
  const taskId = id(form, "task_id");
  if (!templateId || !taskId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const result = await supabase
    .from("template_tasks")
    .update({ is_required: form.get("is_required") === "true" })
    .eq("id", taskId)
    .eq("template_id", templateId)
    .select("id");
  doneChanged(templateId, result);
}

export async function removeTask(form: FormData) {
  const templateId = id(form, "template_id");
  const taskId = id(form, "task_id");
  if (!templateId || !taskId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const result = await supabase
    .from("template_tasks")
    .delete()
    .eq("id", taskId)
    .eq("template_id", templateId)
    .select("id");
  doneChanged(templateId, result);
}

export async function moveItem(form: FormData) {
  const templateId = id(form, "template_id");
  const itemId = id(form, "item_id");
  const kind = form.get("kind") === "section" ? "section" : "task";
  const direction = form.get("direction") === "up" ? -1 : 1;
  if (!templateId || !itemId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const { error } = await supabase.rpc("move_template_item", { p_kind: kind, p_id: itemId, p_direction: direction });
  done(templateId, error);
}

// Перенесення задачі в інший розділ того самого шаблону — функцією бази (роль, розділ і позиція в одній транзакції;
// AC-EDITOR-28).
export async function moveTaskToSection(form: FormData) {
  const templateId = id(form, "template_id");
  const taskId = id(form, "task_id");
  const sectionId = id(form, "section_id");
  if (!templateId || !taskId || !sectionId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const { error } = await supabase.rpc("move_template_task_to_section", { p_task: taskId, p_section: sectionId });
  done(templateId, error);
}

export async function saveVersion(form: FormData) {
  const templateId = id(form, "template_id");
  if (!templateId) redirect("/templates");
  const supabase = await adminClient(editPath(templateId));
  const { data, error } = await supabase.rpc("save_template_version", { p_template_id: templateId });
  revalidatePath(editPath(templateId));
  revalidatePath("/templates");
  if (error) redirect(`${editPath(templateId)}?error=${templateErrorCode(error)}`);
  redirect(`${editPath(templateId)}?saved=${data}`);
}
