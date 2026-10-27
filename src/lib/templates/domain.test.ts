import { describe, expect, it } from "vitest";
import { requiredLabel } from "@/lib/runs/domain";
import {
  cleanName,
  emptyTemplatesMessage,
  formatVersionDate,
  launchOptions,
  messageForTemplateError,
  newestFirst,
  templateErrorCode,
  TEMPLATE_MESSAGES,
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

  it("AC-EDITOR-10: незбережений «Repair» у формі запуску — недоступний з приміткою «Save the template to launch it»", () => {
    const options = launchOptions([
      { id: "r", name: "Repair", current_version: null },
      { id: "t", name: "Tenant move-in", current_version: 1 },
    ]);
    expect(options).toEqual([
      { id: "r", label: "Repair — Save the template to launch it", disabled: true },
      { id: "t", label: "Tenant move-in", disabled: false },
    ]);
  });

  it("AC-EDITOR-17: порожній список шаблонів — менеджеру «No templates yet. An administrator creates them.»", () => {
    expect(emptyTemplatesMessage("manager")).toBe("No templates yet. An administrator creates them.");
    // Адміністратору — з наступною дією (Припущення PM), не текст менеджера.
    expect(emptyTemplatesMessage("admin")).toBe("No templates yet. Create a template to start.");
  });

  it("AC-EDITOR-18: порожній список версій — «No versions yet. Save the template to create version 1.»", () => {
    expect(TEMPLATE_MESSAGES.noVersions).toBe("No versions yet. Save the template to create version 1.");
  });

  it("AC-EDITOR-19: назва порожня або лише з пробілів — шаблон не створюється, «Enter a template name»", () => {
    expect(cleanName("")).toBeNull();
    expect(cleanName("   ")).toBeNull();
    expect(messageForTemplateError("TEMPLATE_NAME_REQUIRED")).toBe("Enter a template name");
  });

  it("AC-EDITOR-15: помилка функції збереження про порожній розділ → «Every section needs at least one task»", () => {
    const code = templateErrorCode({ message: "TEMPLATE_SECTION_EMPTY" });
    expect(code).toBe("TEMPLATE_SECTION_EMPTY");
    expect(messageForTemplateError(code)).toBe("Every section needs at least one task");
  });

  it("AC-EDITOR-23: порушення унікальної назви без урахування регістру → «A template with this name already exists»", () => {
    const code = templateErrorCode({
      message: 'duplicate key value violates unique constraint "templates_name_normalized_key"',
      code: "23505",
    });
    expect(code).toBe("NAME_TAKEN");
    expect(messageForTemplateError(code)).toBe("A template with this name already exists");
  });

  it("AC-EDITOR-16: незбережений шаблон за прямим посиланням → «Template not found»", () => {
    expect(messageForTemplateError("TEMPLATE_NOT_FOUND")).toBe("Template not found");
  });

  it("AC-EDITOR-03: після збереження — «Version 2 saved»", () => {
    expect(TEMPLATE_MESSAGES.versionSaved(2)).toBe("Version 2 saved");
  });

  it("AC-EDITOR-02: задачі поточної версії на сторінці шаблону — з позначкою «required» або «optional»", () => {
    expect([requiredLabel(true), requiredLabel(false)]).toEqual(["required", "optional"]);
  });
});
