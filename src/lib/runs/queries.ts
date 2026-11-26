import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Колонки рядка списку запусків: назва випадку, шаблон, статус і прогрес (AC-TASK-09). */
export const RUN_LIST_COLUMNS = "id, case_name, template_name, status, created_at, done_count, total_count";

/**
 * Запит списку запусків менеджера й адміністратора — єдине місце, де задано порядок рядків: найновіші вгорі
 * (AC-TASK-14), за однакового часу — стабільно за id. Які запуски видно, вирішує RLS (run_overview — security_invoker).
 * Сторінку /runs і тест AC-TASK-14 зв'язує саме ця функція (рев'ю WS6 №1: тест не тримає власної копії сортування).
 */
export function listRuns(supabase: Client) {
  return supabase
    .from("run_overview")
    .select(RUN_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
}

/**
 * Розділи й задачі видимих запусків — для рядків списку, що розгортаються (UI v3). Які рядки видно, вирішує RLS тим
 * самим правилом, що й для сторінки запуску (can_see_run, can_see_run_section, can_see_run_task).
 */
export function listRunContents(supabase: Client, runIds: string[]) {
  return Promise.all([
    supabase.from("run_sections").select("id, run_id, name, position").in("run_id", runIds),
    supabase
      .from("run_tasks")
      .select("run_id, section_id, name, position, is_required, status, is_shown, assignee_id")
      .in("run_id", runIds),
  ]);
}
