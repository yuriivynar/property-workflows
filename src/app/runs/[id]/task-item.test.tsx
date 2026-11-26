// @vitest-environment jsdom
// Миттєва позначка (ADR 0012): відмова сервера повертає рядок на місці — знову «to do», текст AC-TASK-03 дослівно в
// рядку, кнопка «Mark as done» на місці.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const markTaskDoneInPlace = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ markTaskDoneInPlace, markTaskDone: vi.fn() }));

const { TaskItem } = await import("./task-item");

const REFUSAL = "Only the task's assignee, the run manager, or an administrator can mark a task as done";

afterEach(() => {
  cleanup();
  markTaskDoneInPlace.mockReset();
});

const item = () => (
  <TaskItem
    runId="20000000-0000-4000-8000-000000000001"
    taskId="20000000-0000-4000-8000-000000000003"
    name="Sign the lease"
    requiredText="required"
    assignee="manager.b@example.test"
    status="to_do"
    canMark
    confirm={false}
  />
);

describe("TaskItem: миттєва позначка", () => {
  it("AC-TASK-03: сервер відмовив — рядок знову «to do», повідомлення дослівно в рядку, «Mark as done» на місці", async () => {
    markTaskDoneInPlace.mockResolvedValue({ error: REFUSAL });
    render(item());

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
    await vi.waitFor(() => expect(screen.getByTestId("task-status").textContent).toBe("to do"));
    expect(screen.getByRole("button", { name: "Mark as done" })).toBeTruthy();
    expect(markTaskDoneInPlace).toHaveBeenCalledOnce();
  });

  it("AC-TASK-01: позначка без відмови — повідомлення немає, дію викликано з задачею рядка", async () => {
    markTaskDoneInPlace.mockResolvedValue({ error: null });
    render(item());

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    await vi.waitFor(() => expect(markTaskDoneInPlace).toHaveBeenCalledOnce());
    const data = markTaskDoneInPlace.mock.calls[0][0] as FormData;
    expect(data.get("task_id")).toBe("20000000-0000-4000-8000-000000000003");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
