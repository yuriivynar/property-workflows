// Бічна панель від lg (рішення власника 2026-11-26, ADR 0012): розгорнута або згорнута до смуги з іконками; ширину
// розгорнутої змінюють, потягнувши її край, — у межах SIDEBAR_WIDTH. Стан і ширина запам'ятовуються на пристрої в cookie,
// як тема (ADR 0004): сервер одразу малює потрібну панель, без стрибка після завантаження. Телефон цього не має.
export const SIDEBAR_COOKIE = "sidebar";
export const SIDEBAR_WIDTH_COOKIE = "sidebar-width";
export const SIDEBAR_STATES = ["expanded", "collapsed"] as const;
export type SidebarState = (typeof SIDEBAR_STATES)[number];

/** Межі ширини розгорнутої панелі в px; типова — як до зміни розміру (w-60). Крок клавіш ← → — 16 px. */
export const SIDEBAR_WIDTH = { min: 200, max: 360, default: 240, step: 16 } as const;

/** Значення з cookie; невідоме чи відсутнє — «expanded». */
export function parseSidebar(value: unknown): SidebarState {
  return typeof value === "string" && (SIDEBAR_STATES as readonly string[]).includes(value)
    ? (value as SidebarState)
    : "expanded";
}

/** Ширина в межах [min, max], ціла. */
export function clampSidebarWidth(width: number): number {
  return Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));
}

/** Ширина з cookie; не число — типова. */
export function parseSidebarWidth(value: unknown): number {
  const width = typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(width) ? clampSidebarWidth(width) : SIDEBAR_WIDTH.default;
}

export function sidebarCookie(state: SidebarState): string {
  return `${SIDEBAR_COOKIE}=${state}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function sidebarWidthCookie(width: number): string {
  return `${SIDEBAR_WIDTH_COOKIE}=${clampSidebarWidth(width)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Ctrl+B / ⌘B і кнопка в шапці панелі: розгорнута ↔ згорнута. */
export function toggleSidebar(state: SidebarState): SidebarState {
  return state === "expanded" ? "collapsed" : "expanded";
}

export const SIDEBAR_LABELS = {
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  resize: "Resize sidebar",
} as const;
