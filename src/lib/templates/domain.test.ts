import { describe, expect, it } from "vitest";
import {
  formatVersionDate,
  messageForTemplateError,
  newestFirst,
  templateErrorCode,
  templatePageAccess,
} from "./domain";

describe("Шаблони: правила екранів", () => {
  it("AC-EDITOR-05: дата й час версії — за Києвом у форматі DD.MM.YYYY HH:MM до хвилини", () => {
    // 05.10.2026 09:30 і 12.10.2026 14:05 за Києвом (UTC+3 у жовтні до 25.10).
    expect(formatVersionDate("2026-10-05T06:30:00Z")).toBe("05.10.2026 09:30");
    expect(formatVersionDate("2026-10-12T11:05:59.999Z")).toBe("12.10.2026 14:05");
    // Після переходу на зимовий час (25.10) — UTC+2.
    expect(formatVersionDate("2026-10-26T07:00:00Z")).toBe("26.10.2026 09:00");
  });

  it("AC-EDITOR-05: список версій — найновіша перша", () => {
    expect(newestFirst([{ number: 1 }, { number: 3 }, { number: 2 }]).map((v) => v.number)).toEqual([3, 2, 1]);
  });

  it("AC-EDITOR-07: менеджер на списку версій — «Not enough rights», адміністратор бачить список", () => {
    expect(templatePageAccess("manager", "versions")).toBe("not-enough-rights");
    expect(templatePageAccess("admin", "versions")).toBe("ok");
    expect(messageForTemplateError("NOT_ALLOWED")).toBe("Not enough rights");
  });

  it("AC-DSYS-02: менеджер на редакторі — «Not enough rights», поточну версію бачать обидві ролі", () => {
    expect(templatePageAccess("manager", "edit")).toBe("not-enough-rights");
    expect(templatePageAccess("admin", "edit")).toBe("ok");
    expect(templatePageAccess("manager", "view")).toBe("ok");
  });

  it("AC-EDITOR-04: помилка функції збереження → «A template needs at least one required task»", () => {
    const code = templateErrorCode({ message: 'TEMPLATE_NEEDS_REQUIRED_TASK' });
    expect(code).toBe("TEMPLATE_NEEDS_REQUIRED_TASK");
    expect(messageForTemplateError(code)).toBe("A template needs at least one required task");
    expect(
      templateErrorCode({ message: 'duplicate key value violates unique constraint "templates_name_key"', code: "23505" }),
    ).toBe("NAME_TAKEN");
    // Інше обмеження з тим самим кодом — не «назва зайнята».
    expect(templateErrorCode({ message: 'violates unique constraint "template_sections_position_key"', code: "23505" })).toBe(
      "UNEXPECTED",
    );
    expect(messageForTemplateError("SOMETHING_ELSE")).toBe("Your last change was not kept. Try again.");
  });
});
