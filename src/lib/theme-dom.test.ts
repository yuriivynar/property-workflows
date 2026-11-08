import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme } from "./theme-dom";

// applyTheme пише cookie й атрибут на <html> (ADR 0004): без браузера — з підміною document.
function stubDocument() {
  const documentElement = { dataset: {} as Record<string, string> };
  const doc = { cookie: "", documentElement };
  vi.stubGlobal("document", doc);
  return doc;
}

afterEach(() => vi.unstubAllGlobals());

describe("Дизайн-система: застосування теми в браузері", () => {
  it("AC-DSYS-06: обрана Light пишеться в cookie на рік для всіх сторінок і ставиться атрибутом на <html>", () => {
    const doc = stubDocument();

    applyTheme("light");

    expect(doc.cookie).toBe("theme=light; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(doc.documentElement.dataset.theme).toBe("light");
  });

  it("AC-DSYS-05: повернення до System прибирає атрибут — тему вирішує пристрій", () => {
    const doc = stubDocument();
    doc.documentElement.dataset.theme = "dark";

    applyTheme("system");

    expect(doc.cookie).toContain("theme=system");
    expect(doc.documentElement.dataset.theme).toBeUndefined();
  });
});
