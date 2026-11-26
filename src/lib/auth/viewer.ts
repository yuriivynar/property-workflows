import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { toViewer, type Viewer } from "./viewer-data";

export type { Viewer } from "./viewer-data";

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
  return toViewer(claims, profile);
});
