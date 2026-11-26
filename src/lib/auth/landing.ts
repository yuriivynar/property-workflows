import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Куди вести того, хто вже увійшов: на сторінку з посилання (`next`, уже очищений safeNextPath; AC-DSYS-08), а без
 * посилання — вендора на список запусків (AC-VENDOR-13; solomchaak/property-workflows-spec#44), решту — на головну.
 * Спільне для дії входу і для сторінки /login, яку відкрив уже увійдений користувач.
 */
export async function landingPath(supabase: SupabaseClient<Database>, userId: string, next: string): Promise<string> {
  if (next !== "/") return next;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return profile?.role === "vendor" ? "/runs" : "/";
}
