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
