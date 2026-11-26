// Стан бічної панелі (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { describe, expect, it } from "vitest";
import { parseSidebar, sidebarCookie, toggleSidebar } from "./sidebar";

describe("Бічна панель: стан", () => {
  it("cookie: відомі стани — як є, решта — expanded", () => {
    expect(parseSidebar("collapsed")).toBe("collapsed");
    expect(parseSidebar("hidden")).toBe("hidden");
    expect(parseSidebar("wide")).toBe("expanded");
    expect(parseSidebar(undefined)).toBe("expanded");
  });

  it("Ctrl+B: розгорнута ↔ згорнута, прихована → розгорнута", () => {
    expect(toggleSidebar("expanded")).toBe("collapsed");
    expect(toggleSidebar("collapsed")).toBe("expanded");
    expect(toggleSidebar("hidden")).toBe("expanded");
  });

  it("cookie на рік для всього сайту", () => {
    expect(sidebarCookie("hidden")).toBe("sidebar=hidden; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});
