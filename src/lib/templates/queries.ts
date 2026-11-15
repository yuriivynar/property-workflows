import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Шаблони з незбереженими змінами («Unpublished changes», AC-EDITOR-01). Позначку бачить лише адміністратор: колонку
 * templates.has_unpublished_changes менеджеру не видано, а функція бази повертає порожньо всім, крім admin
 * (AC-EDITOR-29; міграція 20261115134842_ws7_review_template_rules.sql). Іншим ролям запиту не робимо зовсім.
 */
export async function unpublishedTemplateIds(supabase: Client, isAdmin: boolean): Promise<Set<string>> {
  if (!isAdmin) return new Set();
  const { data } = await supabase.rpc("templates_with_unpublished_changes");
  return new Set((data ?? []).map((row) => row.id));
}
