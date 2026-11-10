import { describe, expect, it } from "vitest";
import { navItems } from "./nav";

describe("Навігація за роллю", () => {
  it("AC-VENDOR-13: навігація вендора — лише «Runs» і «Profile»", () => {
    expect(navItems("vendor").map((item) => item.label)).toEqual(["Runs", "Profile"]);
    expect(navItems("vendor").map((item) => item.href)).toEqual(["/runs", "/"]);
  });

  it("AC-VENDOR-13: менеджер і адміністратор, як і раніше, бачать ще й «Templates»", () => {
    expect(navItems("manager").map((item) => item.label)).toEqual(["Templates", "Runs", "Profile"]);
    expect(navItems("admin").map((item) => item.label)).toEqual(["Templates", "Runs", "Profile"]);
  });
});
