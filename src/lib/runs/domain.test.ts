// Перевірка назви випадку у формі запуску і тексти повідомлень (openspec/specs/run-launch).
// Те саме правило в базі — tests/db/run-launch.test.ts.
import { describe, expect, it } from "vitest";
import { errorCodeFrom, messageForError, validateCaseName } from "./domain";

describe("Назва випадку", () => {
  it("AC-RUN-03: порожня назва або лише пробіли — запуску немає, повідомлення «Enter a case name»", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const check = validateCaseName(raw);
      expect(check).toEqual({ ok: false, code: "CASE_NAME_REQUIRED" });
      expect(messageForError(check.ok ? undefined : check.code)).toBe("Enter a case name");
    }
  });

  it("AC-RUN-07: 101 символ — повідомлення «Case name must be at most 100 characters»; 100 — дозволено", () => {
    const tooLong = validateCaseName("A".repeat(101));
    expect(tooLong).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
    expect(messageForError(tooLong.ok ? undefined : tooLong.code)).toBe("Case name must be at most 100 characters");

    expect(validateCaseName("A".repeat(100))).toEqual({ ok: true, caseName: "A".repeat(100) });
  });

  it("AC-RUN-07: довжина — у символах, а не в одиницях UTF-16 (кирилиця й емодзі)", () => {
    expect(validateCaseName("Квартира ".repeat(11).slice(0, 100)).ok).toBe(true);
    expect(validateCaseName("🏠".repeat(100)).ok).toBe(true);
    expect(validateCaseName("🏠".repeat(101))).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
  });

  it("AC-RUN-03: пробіли на краях обрізаються, назва зберігається без них", () => {
    expect(validateCaseName("  Apartment 12, move-in  ")).toEqual({ ok: true, caseName: "Apartment 12, move-in" });
  });
});

describe("Помилки функцій бази", () => {
  it("AC-RUN-03: код CASE_NAME_REQUIRED з помилки Supabase дає «Enter a case name»", () => {
    expect(errorCodeFrom("CASE_NAME_REQUIRED")).toBe("CASE_NAME_REQUIRED");
    expect(messageForError(errorCodeFrom("CASE_NAME_REQUIRED"))).toBe("Enter a case name");
  });

  it("AC-RUN-07: код CASE_NAME_TOO_LONG з помилки Supabase дає текст AC-RUN-07", () => {
    expect(messageForError(errorCodeFrom("CASE_NAME_TOO_LONG"))).toBe("Case name must be at most 100 characters");
  });

  it("AC-RUN-04: невідомий код — загальне повідомлення, а не сирий текст бази", () => {
    expect(errorCodeFrom("duplicate key value violates unique constraint")).toBeUndefined();
    expect(messageForError(undefined)).toBe("Something went wrong. Try again.");
    expect(messageForError("INVALID_ASSIGNEE")).toBe("An assignee must be a manager or an administrator");
  });
});

describe("Код помилки з адреси сторінки", () => {
  it("AC-RUN-03: службові ключі (__proto__, constructor, toString) — не коди помилок, а загальне повідомлення-рядок", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(errorCodeFrom(key)).toBeUndefined();
      expect(messageForError(key)).toBe("Something went wrong. Try again.");
    }
  });
});
