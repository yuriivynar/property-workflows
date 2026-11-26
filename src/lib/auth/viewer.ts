import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  userId: string;
  /** Email з профілю (власний), інакше з JWT. */
  email: string | null;
  /** Роль із profiles (ніколи з user_metadata); null — профілю немає. */
  role: string | null;
  /** Шлях власного фото в бакеті avatars (ADR 0012); null — фото немає. */
  avatarPath: string | null;
}

/**
 * Хто відкрив сторінку — один раз на рендер (React `cache()`): макет і сторінка беруть той самий результат, тож
 * getClaims() і запит профілю не повторюються (ADR 0012). Лише для вигляду й вибору гілки сторінки; права на дані
 * перевіряють RLS, функції бази й кожна Server Action (currentUser / requireAdmin до запису).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("email, role, avatar_url").eq("id", claims.sub).maybeSingle();
  const jwtEmail = typeof claims.email === "string" ? claims.email : null;
  return {
    userId: claims.sub,
    email: profile?.email ?? jwtEmail,
    role: profile?.role ?? null,
    avatarPath: profile?.avatar_url ?? null,
  };
});
