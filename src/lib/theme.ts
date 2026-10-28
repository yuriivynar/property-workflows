// Вибір теми (ADR 0004; AC-DSYS-05, AC-DSYS-06): cookie `theme` на пристрої, типово — за пристроєм («System»).
// Чисті функції без браузера — тестуються окремо (src/lib/theme.test.ts).

export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Підписи вибору «Theme» — дослівно з AC-DSYS-05 і AC-DSYS-06. */
export const THEME_LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** Значення cookie → тема; відсутнє чи невідоме — «System» (AC-DSYS-05). */
export function parseTheme(value: unknown): Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value) ? (value as Theme) : "system";
}

/** Атрибут `data-theme` на `<html>`: для «System» атрибута немає — тему вирішує пристрій. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

/** Рядок cookie: діє на всіх сторінках і після перезапуску браузера на цьому пристрої (AC-DSYS-06). */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
