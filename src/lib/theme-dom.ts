import { themeAttribute, themeCookie, type Theme } from "@/lib/theme";

/**
 * Застосовує обрану тему в браузері: cookie на пристрої (AC-DSYS-06) і `data-theme` на <html> (AC-DSYS-05).
 * Окремо від компонента, бо це зміна глобального DOM, а не стану React; чисті функції теми — в `theme.ts`.
 */
export function applyTheme(theme: Theme): void {
  document.cookie = themeCookie(theme);
  const attribute = themeAttribute(theme);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
}
