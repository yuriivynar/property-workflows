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

describe("TaskItem: остання обов'язкова задача", () => {
  it("AC-TASK-04: база відповіла, що задача остання (дані сторінки застаріли), — підтвердження з назвою, без помилки", async () => {
    markTaskDoneInPlace.mockResolvedValue({
      error: "This is the last required task: confirm to mark it as done. This cannot be undone.",
      code: "NEEDS_CONFIRMATION",
    });
    render(item());

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    expect(await screen.findByRole("group", { name: "Confirm mark as done" })).toBeTruthy();
    expect(screen.getByText("Mark «Sign the lease» as done? This cannot be undone.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await vi.waitFor(() => expect(screen.getByTestId("task-status").textContent).toBe("to do"));
  });

  it("AC-TASK-04: позначили першу з двох обов'язкових — друга одразу просить підтвердження, прогрес «1 of 2 done»", async () => {
    const { RunMarksProvider, LiveRunSummary } = await import("./run-marks");
    let resolveMark: (value: { error: null; code: null }) => void = () => {};
    markTaskDoneInPlace.mockReturnValue(new Promise((resolve) => (resolveMark = resolve)));
    const tasks = ["A", "B"].map((id) => ({ id, section_id: "S", is_required: true, status: "to_do", is_shown: true }));
    render(
      <RunMarksProvider tasks={tasks}>
        <LiveRunSummary done={0} total={2} status="in_progress" />
        <ul>
          {tasks.map((task) => (
            <TaskItem key={task.id} runId="R" taskId={task.id} name={`Task ${task.id}`} requiredText="required" assignee="—" status="to_do" canMark confirm={false} />
          ))}
        </ul>
      </RunMarksProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Mark as done" })[0]);

    await vi.waitFor(() => expect(screen.getByTestId("run-progress").textContent).toBe("1 of 2 done"));
    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    expect(screen.getByText("Mark «Task B» as done? This cannot be undone.")).toBeTruthy();
    resolveMark({ error: null, code: null });
  });
});
