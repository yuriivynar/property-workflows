// @vitest-environment jsdom
// Пошук шаблонів за назвою під час набору (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "@/lib/use-debounced-value";
import { matchTemplates, TemplatesBrowser } from "./templates-browser";

const card = (name: string) => <li data-testid="template-row">{name}</li>;
const ITEMS = ["Tenant move-in", "Repair", "Repair request"].map((name, index) => ({
  id: String(index),
  name,
  card: card(name),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shown = () => screen.queryAllByTestId("template-row").map((element) => element.textContent);

describe("Шаблони: пошук", () => {
  it("набір «repair» після паузи лишає лише збіги; без урахування регістру", () => {
    render(<TemplatesBrowser heading={<h1>Templates</h1>} action={null} items={ITEMS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), { target: { value: "REPAIR" } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(shown()).toEqual(["Repair", "Repair request"]);
  });

  it("нічого не знайдено — повідомлення з текстом пошуку", () => {
    render(<TemplatesBrowser heading={<h1>Templates</h1>} action={null} items={ITEMS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), { target: { value: "  boiler " } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(screen.getByRole("status").textContent).toContain("No templates match “boiler”");
    expect(shown()).toEqual([]);
  });

  it("порожній пошук — усі шаблони", () => {
    expect(matchTemplates(ITEMS, "   ")).toHaveLength(3);
  });
});
