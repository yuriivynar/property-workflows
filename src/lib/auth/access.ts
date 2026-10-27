// Хто бачить сторінку без входу: лише сторінка входу й активації. Відвідувач без входу на будь-якій іншій сторінці
// (зокрема за прямим посиланням на запуск чи редактор) потрапляє на сторінку входу (AC-DSYS-03, AC-EDITOR-09).
// Це UX у proxy; дані захищають ще й сторінки (getClaims → /login) і RLS (anon не має прав на таблиці).

export const PUBLIC_PATHS = ["/login", "/auth"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Куди відправити запит: null — показати сторінку, "/login" — на сторінку входу. */
export function signInRedirect(pathname: string, signedIn: boolean): "/login" | null {
  return !signedIn && !isPublicPath(pathname) ? "/login" : null;
}

const ORIGIN = "http://same-origin.invalid";

/**
 * Куди повернути після входу (AC-DSYS-08): лише шлях цього застосунку. Абсолютна адреса, «//host», «/\host» чи сторінка
 * входу — на головну, щоб посилання на вхід не перекидало на чужий сайт (open redirect).
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const url = new URL(value, ORIGIN);
  if (url.origin !== ORIGIN || isPublicPath(url.pathname)) return "/";
  // Після нормалізації «/a/..//host» стає «//host» — браузер прочитав би це як чужий сайт (рев'ю CodeRabbit, PR #24).
  if (url.pathname.startsWith("//")) return "/";
  return `${url.pathname}${url.search}`;
}

/** Сторінка входу з поверненням на запитану сторінку (AC-DSYS-08). */
export function signInUrl(pathname: string, search = ""): string {
  const next = safeNextPath(`${pathname}${search}`);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
