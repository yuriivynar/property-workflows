// @vitest-environment jsdom
// Вкладки й фільтр списку запусків — у браузері, без запиту до сервера; фільтр — під час набору із затримкою
// (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "@/lib/use-debounced-value";
import { RunsBrowser, runsHref, type RunItem } from "./runs-browser";

const row = (name: string) => (
  <tr data-testid="run-row">
    <td>{name}</td>
  </tr>
);

const ITEMS: RunItem[] = [
  { id: "1", case_name: "Apartment 12, move-in", status: "in_progress", row: row("Apartment 12, move-in") },
  { id: "2", case_name: "Apartment 7, leak", status: "completed", row: row("Apartment 7, leak") },
  { id: "3", case_name: "House 3, move-out", status: "in_progress", row: row("House 3, move-out") },
];

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/runs");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const names = () => screen.queryAllByTestId("run-row").map((element) => element.textContent);

describe("Список запусків: вкладки й фільтр у браузері", () => {
  it("вкладка «Completed» — одразу лише завершені, лічильники й адреса ?status=completed", () => {
    render(<RunsBrowser initialTab="all" initialQuery="" items={ITEMS} />);
    expect(screen.getByTestId("runs-tab-in_progress").textContent).toContain("2");

    fireEvent.click(screen.getByTestId("runs-tab-completed"));

    expect(names()).toEqual(["Apartment 7, leak"]);
    expect(screen.getByTestId("runs-tab-completed").getAttribute("aria-current")).toBe("page");
    expect(window.location.search).toBe("?status=completed");
  });

  it("фільтр за назвою спрацьовує під час набору після паузи; адреса — ?q=…", () => {
    render(<RunsBrowser initialTab="all" initialQuery="" items={ITEMS} />);
    fireEvent.change(screen.getByLabelText("Filter by case name"), { target: { value: "apartment" } });

    expect(names()).toHaveLength(3);
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(names()).toEqual(["Apartment 12, move-in", "Apartment 7, leak"]);
    expect(window.location.search).toBe("?q=apartment");
  });

  it("нічого не знайдено — повідомлення замість порожньої таблиці", () => {
    render(<RunsBrowser initialTab="all" initialQuery="Nothing here" items={ITEMS} />);

    expect(screen.getByTestId("runs-no-match").textContent).toContain('No runs match "Nothing here"');
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("адреса без порожніх параметрів", () => {
    expect(runsHref("all", "")).toBe("/runs");
    expect(runsHref("in_progress", "flat 3")).toBe("/runs?status=in_progress&q=flat+3");
  });
});
