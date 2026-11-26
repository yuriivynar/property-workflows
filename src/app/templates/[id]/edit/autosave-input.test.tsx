// @vitest-environment jsdom
// Назва в редакторі зберігається, щойно поле втратило фокус; кнопки «Rename» немає (рішення власника 2026-11-26,
// ADR 0012; поза вимогами PM — без AC ID).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutosaveInput } from "./autosave-input";

afterEach(cleanup);

function renderField() {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <label htmlFor="task">Task</label>
      <AutosaveInput id="task" name="name" defaultValue="Hand over the keys" />
    </form>,
  );
  return { submit, input: screen.getByLabelText("Task") as HTMLInputElement };
}

describe("Редактор: назва зберігається при втраті фокусу", () => {
  it("змінили й вийшли з поля — форма надсилається один раз", () => {
    const { submit, input } = renderField();
    fireEvent.change(input, { target: { value: "Hand over two keys" } });
    fireEvent.blur(input);
    fireEvent.blur(input);

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("нічого не змінили — нічого не надсилається", () => {
    const { submit, input } = renderField();
    fireEvent.blur(input);
    expect(submit).not.toHaveBeenCalled();
  });

  it("Enter зберігає, і подальша втрата фокусу не надсилає те саме вдруге", () => {
    const { submit, input } = renderField();
    fireEvent.change(input, { target: { value: "Sign handover act" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("Esc повертає збережену назву без надсилання", () => {
    const { submit, input } = renderField();
    fireEvent.change(input, { target: { value: "Typo" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("Hand over the keys");
    expect(submit).not.toHaveBeenCalled();
  });

  it("збереження не вдалося — повернулись у поле, Enter надсилає те саме значення ще раз", () => {
    const { submit, input } = renderField();
    fireEvent.change(input, { target: { value: "Hand over two keys" } });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("кнопки «Rename» немає", () => {
    renderField();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
  });
});
