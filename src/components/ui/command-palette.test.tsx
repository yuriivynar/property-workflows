// @vitest-environment jsdom
// Палітра ⌘K (UI v3, рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID): відкривається кнопкою й
// клавішами, показує дані з load і фільтрує їх за введеним текстом. Регресія: без обгортки <Command> (cmdk) відкриття
// палітри валило сторінку («This page couldn't load»).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SearchItem } from "@/app/search/actions";
import { CommandPalette } from "./command-palette";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  // cmdk прокручує вибраний пункт і стежить за розміром списку — у jsdom цих API немає.
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const ITEMS: SearchItem[] = [
  { group: "Runs", label: "Apartment 12, move-in", hint: "1 of 5 done", href: "/runs/1" },
  { group: "Templates", label: "Repair", hint: "Template", href: "/templates/2" },
  { group: "Actions", label: "Open your profile", hint: "Action", href: "/" },
];

describe("Палітра ⌘K", () => {
  it("кнопка «Search everything» відкриває палітру з запусками, шаблонами й діями", async () => {
    render(<CommandPalette load={async () => ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: /Search everything/ }));

    expect(await screen.findByText("Apartment 12, move-in")).toBeTruthy();
    expect(screen.getByText("Repair")).toBeTruthy();
    expect(screen.getByText("Open your profile")).toBeTruthy();
  });

  it("Ctrl+K відкриває палітру; введений текст лишає лише збіги", async () => {
    render(<CommandPalette load={async () => ITEMS} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await screen.findByText("Repair");

    fireEvent.change(screen.getByLabelText("Search runs, templates and actions"), {
      target: { value: "repair" },
    });

    expect(await screen.findByText("Repair")).toBeTruthy();
    expect(screen.queryByText("Apartment 12, move-in")).toBeNull();
  });
});
