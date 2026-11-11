import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSwitch } from "./theme-switch";

// Вибір «Theme» (ADR 0004, ADR 0008): меню з трьома нативними радіокнопками, обрана — `checked`; закрите меню
// показує «Theme» і поточне значення.
const summary = (html: string) =>
  /<summary[^>]*>([\s\S]*?)<\/summary>/
    .exec(html)?.[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const radios = (html: string) =>
  [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(([tag]) => ({
    value: /value="([^"]+)"/.exec(tag)?.[1],
    checked: /\schecked(=|\s|>)/.test(tag),
  }));

describe("Дизайн-система: вибір «Theme»", () => {
  it("AC-DSYS-05: тему не обрано — група «Theme» показує «System» обраним, поруч Light і Dark", () => {
    const html = renderToStaticMarkup(<ThemeSwitch value="system" />);

    expect(summary(html)).toBe("Theme System");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain(">System<");
    expect(html).toContain(">Light<");
    expect(html).toContain(">Dark<");
    expect(radios(html)).toEqual([
      { value: "system", checked: true },
      { value: "light", checked: false },
      { value: "dark", checked: false },
    ]);
  });

  it("AC-DSYS-06: обрано «Light» — у групі «Theme» обрана лише Light, і так щоразу після відновлення з cookie", () => {
    const first = renderToStaticMarkup(<ThemeSwitch value="light" />);
    const second = renderToStaticMarkup(<ThemeSwitch value="light" />);

    expect(radios(first)).toEqual([
      { value: "system", checked: false },
      { value: "light", checked: true },
      { value: "dark", checked: false },
    ]);
    expect(summary(first)).toBe("Theme Light");
    expect(second).toBe(first);
  });
});
