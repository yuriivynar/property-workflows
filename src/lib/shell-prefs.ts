import "server-only";
import { cookies } from "next/headers";
import { parseSidebar, parseSidebarWidth, SIDEBAR_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

/**
 * Особисті налаштування оболонки з cookie — до першого малювання, без стрибка: тема (ADR 0004; AC-DSYS-05, AC-DSYS-06),
 * стан і ширина бічної панелі (рішення власника 2026-11-26, ADR 0012).
 */
export async function shellPrefs() {
  const store = await cookies();
  return {
    theme: parseTheme(store.get(THEME_COOKIE)?.value),
    sidebar: parseSidebar(store.get(SIDEBAR_COOKIE)?.value),
    sidebarWidth: parseSidebarWidth(store.get(SIDEBAR_WIDTH_COOKIE)?.value),
  };
}
