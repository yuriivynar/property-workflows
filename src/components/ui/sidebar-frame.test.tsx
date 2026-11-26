// @vitest-environment jsdom
// Бічна панель: розгорнута, згорнута, прихована (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SidebarControls, SidebarFrame } from "./sidebar-frame";

afterEach(() => {
  cleanup();
  document.cookie = "sidebar=; Max-Age=0; Path=/";
});

function renderFrame(initial: "expanded" | "collapsed" | "hidden" = "expanded") {
  render(
    <SidebarFrame initial={initial} sidebar={<SidebarControls />}>
      <p>Page</p>
    </SidebarFrame>,
  );
  return document.querySelector("[data-slot=app-sidebar]") as HTMLElement;
}

describe("Бічна панель", () => {
  it("«Collapse sidebar» згортає до смуги, «Expand sidebar» розгортає; стан — у cookie", () => {
    const aside = renderFrame();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(aside.dataset.state).toBe("collapsed");
    expect(document.cookie).toContain("sidebar=collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(aside.dataset.state).toBe("expanded");
  });

  it("«Hide sidebar» ховає панель і показує «Show sidebar», яка повертає розгорнуту", () => {
    const aside = renderFrame();
    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(aside.dataset.state).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(aside.dataset.state).toBe("expanded");
    expect(screen.queryByRole("button", { name: "Show sidebar" })).toBeNull();
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
