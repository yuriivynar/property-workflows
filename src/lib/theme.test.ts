import { describe, expect, it } from "vitest";
import { parseTheme, THEME_LABELS, themeAttribute, themeCookie } from "./theme";

describe("Вибір теми", () => {
  it("AC-DSYS-05: тему не обрано — «Theme» показує «System», data-theme немає, тему вирішує пристрій", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(THEME_LABELS[parseTheme(undefined)]).toBe("System");
    expect(themeAttribute("system")).toBeUndefined();
    // Невідоме значення cookie — теж «System».
    expect(parseTheme("blue")).toBe("system");
  });

  it("AC-DSYS-06: обране «Light» запам'ятовується на пристрої й діє після перезапуску браузера", () => {
    const cookie = themeCookie("light");
    expect(cookie).toMatch(/^theme=light;/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000"); // не сесійна cookie: переживає перезапуск браузера
    // Наступний рендер читає те саме значення: data-theme="light", «Theme» показує «Light».
    const value = cookie.split(";")[0].split("=")[1];
    expect(parseTheme(value)).toBe("light");
    expect(themeAttribute(parseTheme(value))).toBe("light");
    expect(THEME_LABELS[parseTheme(value)]).toBe("Light");
  });

  it("AC-DSYS-06: обране «Dark» зберігається без змін — data-theme=\"dark\", «Theme» показує «Dark»", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(themeAttribute("dark")).toBe("dark");
    expect(THEME_LABELS.dark).toBe("Dark");
    expect(themeCookie("dark")).toMatch(/^theme=dark;/);
  });
});
