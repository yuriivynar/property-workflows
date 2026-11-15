// @vitest-environment jsdom
// AC-TASK-16 на рівні інтерфейсу (рев'ю WS6 №1): Cancel на підтвердженні останньої обов'язкової задачі нічого не
// надсилає й повертає кнопку «Mark as done». Що база без підтвердження нічого не змінює — тести бази й дії.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const markTaskDone = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ markTaskDone }));

const { MarkDoneButton } = await import("./mark-done-button");

afterEach(() => {
  cleanup();
  markTaskDone.mockClear();
});

const RUN = "20000000-0000-4000-8000-000000000001";
const TASK = "20000000-0000-4000-8000-000000000003";

describe("MarkDoneButton", () => {
  it("AC-TASK-16: останню обов'язкову задачу скасовано на підтвердженні — нічого не надіслано, знову «Mark as done»", () => {
    render(<MarkDoneButton runId={RUN} taskId={TASK} taskName="Hand over the keys" confirm />);

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    const group = screen.getByRole("group", { name: "Confirm mark as done" });
    expect(group.textContent).toContain("Mark «Hand over the keys» as done? This cannot be undone.");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Confirm mark as done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark as done" })).toBeTruthy();
    expect(markTaskDone).not.toHaveBeenCalled();
  });

  it("AC-TASK-01: не остання обов'язкова задача — одна кнопка «Mark as done» без підтвердження й без «This cannot be undone»", () => {
    render(<MarkDoneButton runId={RUN} taskId={TASK} taskName="Sign the lease" confirm={false} />);

    expect(screen.getByRole("button", { name: "Mark as done" }).getAttribute("type")).toBe("submit");
    expect(screen.queryByText(/This cannot be undone/)).toBeNull();
  });
});
