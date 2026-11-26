// Стан і ширина бічної панелі (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { describe, expect, it } from "vitest";
import { clampSidebarWidth, parseSidebar, parseSidebarWidth, sidebarCookie, sidebarWidthCookie, toggleSidebar } from "./sidebar";

describe("Бічна панель: стан і ширина", () => {
  it("cookie стану: відомі — як є, решта (зокрема колишній «hidden») — expanded", () => {
    expect(parseSidebar("collapsed")).toBe("collapsed");
    expect(parseSidebar("hidden")).toBe("expanded");
    expect(parseSidebar(undefined)).toBe("expanded");
  });

  it("Ctrl+B: розгорнута ↔ згорнута", () => {
    expect(toggleSidebar("expanded")).toBe("collapsed");
    expect(toggleSidebar("collapsed")).toBe("expanded");
  });

  it("ширина — у межах 200…360 px; не число — 240", () => {
    expect(clampSidebarWidth(120)).toBe(200);
    expect(clampSidebarWidth(500)).toBe(360);
    expect(clampSidebarWidth(287.6)).toBe(288);
    expect(parseSidebarWidth("300")).toBe(300);
    expect(parseSidebarWidth("9999")).toBe(360);
    expect(parseSidebarWidth("wide")).toBe(240);
    expect(parseSidebarWidth(undefined)).toBe(240);
  });

  it("cookie на рік для всього сайту", () => {
    expect(sidebarCookie("collapsed")).toBe("sidebar=collapsed; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(sidebarWidthCookie(999)).toBe("sidebar-width=360; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});
