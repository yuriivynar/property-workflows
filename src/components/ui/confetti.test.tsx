// @vitest-environment jsdom
// Конфеті на завершення запуску (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID): лише коли запуск
// щойно став завершеним, не на вже завершеному; прибирається сам; декоративне.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Confetti, useCompletionBurst } from "./confetti";

function Probe({ completed }: { completed: boolean }) {
  const bursts = useCompletionBurst(completed);
  return bursts > 0 ? <Confetti key={bursts} /> : null;
}

const confetti = () => document.querySelector("[data-slot=confetti]");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Конфеті", () => {
  it("запуск щойно завершено — спалах (aria-hidden), за ~2 с прибирається", () => {
    const { rerender } = render(<Probe completed={false} />);
    expect(confetti()).toBeNull();

    rerender(<Probe completed />);
    expect(confetti()?.getAttribute("aria-hidden")).toBe("true");
    expect(confetti()?.querySelectorAll(".confetti-piece")).toHaveLength(28);

    act(() => vi.advanceTimersByTime(2200));
    expect(confetti()).toBeNull();
  });

  it("уже завершений запуск, відкритий наново, — без конфеті", () => {
    render(<Probe completed />);
    expect(confetti()).toBeNull();
  });
});
