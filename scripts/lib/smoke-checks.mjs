// Дія з postmortem 2026-11-23 (docs/incidents/2026-11-23-staging-bad-supabase-url.md): smoke не лише бачить, що база
// «down», а й каже, ЧОМУ — середовище ходить не в ту базу. Чисті функції без мережі й process.env — їх перевіряє
// tests/smoke-checks.test.ts; викликає scripts/smoke.mjs.

/**
 * Чи health показує очікуваний проєкт Supabase. expectedRef — ref із змінної репо (SUPABASE_STAGING_REF для preview і
 * staging, SUPABASE_PROD_REF для проду), порожній — перевірку пропускаємо. Повертає текст збою або null.
 * Ref не секрет (він у публічній адресі бази), тож його можна друкувати в журналі й алерті.
 */
export function supabaseRefProblem(health, expectedRef) {
  const expected = (expectedRef ?? "").trim();
  if (!expected || !health || typeof health !== "object") return null;
  const actual = health.supabaseRef;
  if (actual === expected) return null;
  if (actual === undefined) return null; // старий деплой без поля supabaseRef — нема з чим порівнювати
  const shown = actual === null ? "немає (змінна не задана)" : String(actual);
  return `"/api/health": supabaseRef ${shown}, а очікувався ${expected} — NEXT_PUBLIC_SUPABASE_URL у Vercel для цього середовища вказує не на ту базу (звірте змінну для Production / Preview / гілки staging і зробіть Redeploy)`;
}

/** Підказка з поля suspectEnv health: назва змінної, яку варто перевірити першою (значення health не віддає). */
export function suspectEnvHint(health) {
  const name = health && typeof health === "object" ? health.suspectEnv : null;
  return typeof name === "string" && /^[A-Z0-9_]+$/.test(name) ? ` — перевірте змінну ${name} у Vercel для цього середовища` : "";
}

/**
 * Чи можна надіслати секрет обходу захисту Vercel на цю адресу (рев'ю 2026-11-26): лише https і хост *.vercel.app або
 * хост проду з PROD_URL. Помилка в адресі ручного запуску (чи підроблений client_payload.url) не віддасть секрет
 * сторонньому серверу — smoke піде без заголовка й чесно впаде на стіні входу.
 * @param {string} base адреса деплою (з https://)
 * @param {string} prodUrl PROD_URL (може бути порожньою)
 */
export function bypassAllowedFor(base, prodUrl = "") {
  let url;
  try {
    url = new URL(base);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname.endsWith(".vercel.app")) return true;
  try {
    return Boolean(prodUrl) && new URL(/^https?:\/\//.test(prodUrl) ? prodUrl : `https://${prodUrl}`).hostname === url.hostname;
  } catch {
    return false;
  }
}
