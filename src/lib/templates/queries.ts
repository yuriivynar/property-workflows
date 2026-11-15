import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Шаблони з незбереженими змінами («Unpublished changes», AC-EDITOR-01). Позначку бачить лише адміністратор: колонку
 * templates.has_unpublished_changes менеджеру не видано, а функція бази повертає порожньо всім, крім admin
 * (AC-EDITOR-29; міграція 20261115134842_ws7_review_template_rules.sql). Іншим ролям запиту не робимо зовсім.
 * Помилку RPC кидаємо далі — її покаже обробник помилок сторінки.
 */
export async function unpublishedTemplateIds(supabase: Client, isAdmin: boolean): Promise<Set<string>> {
  if (!isAdmin) return new Set();
  const { data, error } = await supabase.rpc("templates_with_unpublished_changes");
  // Помилка — не «змін немає»: інакше редактор сховав би позначку й вимкнув Save (рев'ю CodeRabbit, PR #80).
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}
