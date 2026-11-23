// D0: чи відповіла база на запит /api/health. Чиста функція — щоб перевірити всі гілки тестом без мережі.
// Запит — публічним ключем до таблиці без доступу для anon: «немає прав» (42501) теж означає, що Postgres живий.

/** Код SQLSTATE Postgres, напр. 42501 «permission denied»: запит дійшов до бази. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** PostgREST не може під'єднатися до бази. */
const PGRST_DB_DOWN = /^PGRST00[0-3]$/;
/** Supabase відповідає 540, коли безкоштовний проєкт призупинено (Dashboard → Resume project). */
const SUPABASE_PAUSED = 540;

export type DbProbe = { status: number; error: { code?: string; message?: string } | null };
export type DbHealth = { db: "ok" | "down"; reason: string };

export function classifyDbProbe({ status, error }: DbProbe): DbHealth {
  if (status === SUPABASE_PAUSED) return { db: "down", reason: "paused" };
  const code = error?.code ?? "";
  // 0 — мережа, 5xx — збій на боці сервера: навіть із кодом SQLSTATE (08006 — обрив з'єднання) база не «відповіла».
  if (status === 0 || status >= 500) return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
  if (!error || SQLSTATE.test(code) || (code.startsWith("PGRST") && !PGRST_DB_DOWN.test(code))) {
    return { db: "ok", reason: "" };
  }
  if (/api key/i.test(error.message ?? "")) return { db: "down", reason: "invalid-api-key" };
  // PGRST000–003 з не-5xx статусом.
  return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
}

/**
 * Дія з postmortem 2026-11-23 (docs/incidents/2026-11-23-staging-bad-supabase-url.md): яку змінну перевірити першою,
 * коли база «down». Лише НАЗВА, без значення. Порожня змінна — вона сама; хибний ключ — ключ; база не відповідає за
 * адресою (мережа, виняток) — адреса. Інші причини (пауза, 5xx Supabase) — не змінна: null.
 */
export function suspectEnvFor(
  health: DbHealth,
  env: { url: string | undefined; key: string | undefined },
): "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | null {
  if (!env.url?.trim()) return "NEXT_PUBLIC_SUPABASE_URL";
  if (!env.key?.trim()) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  if (health.db === "ok") return null;
  if (health.reason === "invalid-api-key") return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  if (health.reason === "status-0" || health.reason === "exception") return "NEXT_PUBLIC_SUPABASE_URL";
  return null;
}

/** WS11: назва середовища з APP_ENV (на staging — «staging»; VERCEL_ENV там теж «preview»). Без змінної — null. */
export function appEnvFrom(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * WS11: ref проєкту Supabase — перший сегмент хоста публічної адреси бази (https://<ref>.supabase.co). Не секрет:
 * та сама адреса є в браузері. За ним видно, що staging і preview ходять не в прод-базу. Без змінної чи з
 * некоректною адресою — null.
 */
export function supabaseRefFrom(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return ref ? ref : null;
  } catch {
    return null;
  }
}
