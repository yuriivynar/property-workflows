// Статуси в темній темі (AC-DSYS-07): ті самі слова й кольори за змістом, що у світлій, контраст тексту до тла ≥ 4.5.
// Токени читаємо з src/app/globals.css, класи — з мапи StatusBadge, тож тест ловить зміну будь-якого з двох.
// Контраст — WCAG 2.x: OKLCH → OKLab → лінійний sRGB (з обрізанням) → відносна яскравість (DESIGN.md, розділ 2).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STATUSES } from "@/components/ui/status-badge";

type Oklch = [number, number, number];

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
// Блоки токенів, а не @custom-variant dark вище: світлі — «:root {» з нового рядка; системні темні — @media з :root.
const darkStart = css.indexOf("@media (prefers-color-scheme: dark) {\n  :root");
const lightBlock = css.slice(css.indexOf("\n:root {"), darkStart);
const darkBlock = css.slice(darkStart);

function token(block: string, name: string): Oklch {
  const match = block.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`));
  if (!match) throw new Error(`token --${name} not found`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([L, C, H]: Oklch): number {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const contrast = (x: Oklch, y: Oklch) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

/** Назва токена тла зі класу StatusBadge: «bg-status-done text-…» → «status-done». */
const toneOf = (className: string) => className.match(/bg-(status-[a-z-]+)/)![1];

describe("Дизайн-система: статуси в темній темі", () => {
  it("AC-DSYS-07: «in progress» і «completed» — словом, синім і зеленим як у світлій темі, контраст ≥ 4.5", () => {
    const cases = [
      { status: STATUSES.in_progress, word: "in progress", hue: [230, 270] },
      { status: STATUSES.completed, word: "completed", hue: [130, 170] },
    ] as const;

    for (const { status, word, hue } of cases) {
      expect(status.label).toBe(word);
      const tone = toneOf(status.className);
      expect(status.className).toContain(`text-${tone}-foreground`);

      for (const block of [lightBlock, darkBlock]) {
        const bg = token(block, tone);
        const fg = token(block, `${tone}-foreground`);
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        // Той самий колір за змістом: відтінок тла й тексту — у межах синього / зеленого в обох темах.
        for (const [, , h] of [bg, fg]) {
          expect(h).toBeGreaterThanOrEqual(hue[0]);
          expect(h).toBeLessThanOrEqual(hue[1]);
        }
      }
    }
  });

  it("AC-DSYS-06: обрана Light переважає темний пристрій, обрана Dark — ті самі темні токени, що й системна темна тема", () => {
    const declarations = (block: string) =>
      Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
    const systemDark = css.slice(darkStart, css.indexOf("\n}\n", darkStart));
    const explicitStart = css.indexOf(':root[data-theme="dark"] {');
    expect(explicitStart).toBeGreaterThan(-1);
    const explicitDark = css.slice(explicitStart, css.indexOf("\n}\n", explicitStart));

    // Системна темна тема не діє, якщо обрано Light.
    expect(systemDark).toContain(':root:not([data-theme="light"])');
    expect(Object.keys(declarations(explicitDark)).length).toBeGreaterThan(20);
    expect(declarations(explicitDark)).toEqual(declarations(systemDark));
  });
});
