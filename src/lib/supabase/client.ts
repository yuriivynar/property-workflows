// fallow-ignore-file unused-file -- каркас шаблону (AGENTS.md, «Структура»): поки жоден Client Component не ходить у
// Supabase напряму, але перший такий запит має брати саме цей клієнт, а не створювати свій.
// Клієнт Supabase для браузера (Client Components).
// Офіційний патерн: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
