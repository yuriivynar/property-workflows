import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Перевірка входу й ролі в кожній server action і сторінці зрізу (openspec/changes/impl-template-versions/design.md,
// «Auth»): getClaims() перевіряє JWT, роль — з public.profiles за claims.sub, ніколи з user_metadata. Викликається
// ДО будь-якого запису; запис потім робить клієнт користувача під RLS і GRANT (друга лінія захисту). proxy.ts лише
// перенаправляє на /login — це UX, не захист.

export type AppRole = "manager" | "admin";

export type RoleCheck =
  | { ok: true; userId: string; role: AppRole }
  | { ok: false; reason: "NOT_SIGNED_IN" | "NOT_ALLOWED" };

type Client = SupabaseClient<Database>;

export async function currentUser(supabase: Client): Promise<RoleCheck> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { ok: false, reason: "NOT_SIGNED_IN" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = profile?.role;
  if (role !== "manager" && role !== "admin") return { ok: false, reason: "NOT_ALLOWED" };
  return { ok: true, userId, role };
}

/** Лише адміністратор (шаблони змінює лише admin — матриця прав; AC-EDITOR-08, AC-DSYS-02, AC-EDITOR-07). */
export async function requireAdmin(supabase: Client): Promise<RoleCheck> {
  const user = await currentUser(supabase);
  if (!user.ok) return user;
  if (user.role !== "admin") return { ok: false, reason: "NOT_ALLOWED" };
  return user;
}
