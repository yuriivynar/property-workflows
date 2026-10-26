import { describe, expect, it } from "vitest";
import { isPublicPath, signInRedirect } from "./access";

describe("Вхід: що бачить відвідувач без входу", () => {
  it("AC-DSYS-03: відвідувач без входу за прямим посиланням на запуск — на сторінку входу", () => {
    expect(signInRedirect("/runs/10000000-0000-4000-8000-0000000000a1", false)).toBe("/login");
    expect(signInRedirect("/runs", false)).toBe("/login");
    // Після входу сторінка запуску відкривається (що саме видно — вирішують сторінка й RLS).
    expect(signInRedirect("/runs/10000000-0000-4000-8000-0000000000a1", true)).toBeNull();
  });

  it("AC-EDITOR-09: відвідувач без входу за прямим посиланням на редактор — на сторінку входу", () => {
    expect(signInRedirect("/templates/10000000-0000-4000-8000-000000000001/edit", false)).toBe("/login");
    expect(signInRedirect("/templates", false)).toBe("/login");
  });

  it("AC-DSYS-03: без входу відкриваються лише сторінки входу й активації", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(signInRedirect("/login", false)).toBeNull();
  });
});
