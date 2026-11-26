// @vitest-environment jsdom
// Меню відповіді «Urgency» (варіант «detail», рішення власника 2026-11-26): підпис з великої літери, «No answer» без
// відповіді, вибір надсилає setRunFieldAnswer зі збереженою відповіддю як у тексті PM.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setRunFieldAnswer = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ setRunFieldAnswer }));

const { UrgencyMenu } = await import("./urgency-menu");

const OPTIONS = [
  { value: "urgent", effect: 'Adds "Send an emergency plumber" to Assessment' },
  { value: "not urgent", effect: "No extra tasks" },
];

afterEach(() => {
  cleanup();
  setRunFieldAnswer.mockClear();
});

describe("UrgencyMenu", () => {
  it("AC-LOGIC-01: поле без відповіді — «Urgency: No answer»", () => {
    render(<UrgencyMenu runId="r" fieldId="f" fieldName="Urgency" answer={null} options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Urgency: No answer" })).toBeTruthy();
  });

  it("AC-LOGIC-02: вибір «Urgent» надсилає відповідь «urgent»; опис ефекту видно під відповіддю", async () => {
    render(<UrgencyMenu runId="r" fieldId="f" fieldName="Urgency" answer={null} options={OPTIONS} />);
    fireEvent.click(screen.getByRole("button", { name: "Urgency: No answer" }));
    expect(await screen.findByText('Adds "Send an emergency plumber" to Assessment')).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Urgent/ }));

    expect(setRunFieldAnswer).toHaveBeenCalledOnce();
    const data = setRunFieldAnswer.mock.calls[0][0] as FormData;
    expect(data.get("answer")).toBe("urgent");
    expect(data.get("field_id")).toBe("f");
  });

  it("відповідь показано з великої літери — «Not urgent», зберігається «not urgent»", () => {
    render(<UrgencyMenu runId="r" fieldId="f" fieldName="Urgency" answer="not urgent" options={OPTIONS} />);
    expect(screen.getByRole("button", { name: "Urgency: Not urgent" })).toBeTruthy();
  });

  it("у рядку-«привиді» — кнопка «Set Urgency»", () => {
    render(<UrgencyMenu runId="r" fieldId="f" fieldName="Urgency" answer={null} options={OPTIONS} trigger="set" />);
    expect(screen.getByRole("button", { name: "Set Urgency" })).toBeTruthy();
  });
});
