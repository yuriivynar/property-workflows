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
