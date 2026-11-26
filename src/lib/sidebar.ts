// Стан бічної панелі від lg (рішення власника 2026-11-26, ADR 0012): розгорнута, згорнута до смуги з іконками або
// прихована. Запам'ятовується на пристрої в cookie, як тема (ADR 0004): сервер одразу малює потрібну ширину, без
// стрибка після завантаження. Телефон цього не має: там верхня смуга й нижні вкладки.
export const SIDEBAR_COOKIE = "sidebar";
export const SIDEBAR_STATES = ["expanded", "collapsed", "hidden"] as const;
export type SidebarState = (typeof SIDEBAR_STATES)[number];

/** Значення з cookie; невідоме чи відсутнє — «expanded». */
export function parseSidebar(value: unknown): SidebarState {
  return typeof value === "string" && (SIDEBAR_STATES as readonly string[]).includes(value)
    ? (value as SidebarState)
    : "expanded";
}

export function sidebarCookie(state: SidebarState): string {
  return `${SIDEBAR_COOKIE}=${state}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Ctrl+B / ⌘B: розгорнута ↔ згорнута; прихована — знову розгорнута. */
export function toggleSidebar(state: SidebarState): SidebarState {
  return state === "expanded" ? "collapsed" : "expanded";
}

export const SIDEBAR_LABELS = {
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  hide: "Hide sidebar",
  show: "Show sidebar",
} as const;
