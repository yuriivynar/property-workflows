// @vitest-environment jsdom
// Бічна панель: згорнути / розгорнути й ширина за край (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SidebarControls, SidebarFrame } from "./sidebar-frame";

afterEach(() => {
  cleanup();
  document.cookie = "sidebar=; Max-Age=0; Path=/";
  document.cookie = "sidebar-width=; Max-Age=0; Path=/";
});

function renderFrame(initial: "expanded" | "collapsed" = "expanded", initialWidth = 240) {
  render(
    <SidebarFrame initial={initial} initialWidth={initialWidth} sidebar={<SidebarControls />}>
      <p>Page</p>
    </SidebarFrame>,
  );
  return document.querySelector("[data-slot=app-sidebar]") as HTMLElement;
}

const handle = () => screen.getByRole("separator", { name: "Resize sidebar" });

describe("Бічна панель", () => {
  it("«Collapse sidebar» згортає до смуги (без ручки), «Expand sidebar» розгортає; стан — у cookie", () => {
    const aside = renderFrame();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(aside.dataset.state).toBe("collapsed");
    expect(document.cookie).toContain("sidebar=collapsed");
    expect(screen.queryByRole("separator")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(aside.dataset.state).toBe("expanded");
  });

  it("кнопки «Hide sidebar» немає", () => {
    renderFrame();
    expect(screen.queryByRole("button", { name: /Hide sidebar/ })).toBeNull();
  });

  it("перетягування краю змінює ширину в межах 200…360 px і пише її в cookie після відпускання", () => {
    const aside = renderFrame();
    fireEvent.pointerDown(handle(), { button: 0, clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 300, pointerId: 1 });

    expect(aside.style.getPropertyValue("--sidebar-width")).toBe("300px");
    expect(document.cookie).not.toContain("sidebar-width");

    fireEvent.pointerMove(handle(), { clientX: 900, pointerId: 1 });
    fireEvent.pointerUp(handle(), { clientX: 900, pointerId: 1 });

    expect(handle().getAttribute("aria-valuenow")).toBe("360");
    expect(document.cookie).toContain("sidebar-width=360");
  });

  it("клавіші: ← звужує на 16 px, Home — мінімум, End — максимум; подвійний клік — 240", () => {
    renderFrame("expanded", 300);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(handle().getAttribute("aria-valuenow")).toBe("284");

    fireEvent.keyDown(handle(), { key: "Home" });
    expect(handle().getAttribute("aria-valuenow")).toBe("200");
    fireEvent.keyDown(handle(), { key: "End" });
    expect(handle().getAttribute("aria-valuenow")).toBe("360");

    fireEvent.doubleClick(handle());
    expect(handle().getAttribute("aria-valuenow")).toBe("240");
  });

  it("Ctrl+B перемикає розгорнуту й згорнуту, але не під час набору в полі", () => {
    const aside = renderFrame("collapsed");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(aside.dataset.state).toBe("expanded");

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(aside.dataset.state).toBe("expanded");
    input.remove();
  });
});
