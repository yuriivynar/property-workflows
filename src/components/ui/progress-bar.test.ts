import { describe, expect, it } from "vitest";
import { progressPercent } from "./progress-bar";

describe("Смужка прогресу «N of M done»", () => {
  it("AC-TASK-09: частка виконаного — від 0 до 100, нуль задач не ділить на нуль", () => {
    expect(progressPercent(0, 5)).toBe(0);
    expect(progressPercent(2, 5)).toBe(40);
    expect(progressPercent(5, 5)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("AC-TASK-09: незавершений запуск ніколи не виглядає повним — 199 із 200 це 99 %", () => {
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(200, 200)).toBe(100);
  });
});
