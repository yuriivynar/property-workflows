import { describe, expect, it } from "vitest";
import { DOCUMENT_ERRORS, confirmedValuesFrom, documentTextFrom, formatConfirmedAt } from "./form";
import { MAX_INPUT_CHARS } from "./values";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe("Форма блоку «Parse a document»", () => {
  it("AC-DOCAI-08: текст документа обрізано; порожній чи задовгий — помилка до виклику моделі", () => {
    expect(documentTextFrom(form([["document_text", "  Kitchen tap  "]]))).toEqual({ ok: true, text: "Kitchen tap" });
    expect(documentTextFrom(form([["document_text", "   "]]))).toMatchObject({ ok: false, message: DOCUMENT_ERRORS.emptyText });
    expect(documentTextFrom(form([["document_text", "x".repeat(MAX_INPUT_CHARS + 1)]]))).toMatchObject({
      ok: false,
      message: DOCUMENT_ERRORS.tooLong,
    });
  });

  it("AC-DOCAI-08: кошторис з полів людини — порожні рядки пропущено, кома як десятковий роздільник", () => {
    const parsed = confirmedValuesFrom(
      form([
        ["kind", "estimate"],
        ["item_name", "Labour"],
        ["item_quantity_0", "2"],
        ["item_unit_price_0", "45,50"],
        ["item_name", ""],
        ["item_quantity_1", ""],
        ["item_unit_price_1", ""],
        ["total", "91"],
        ["notes", "the email has two problems"],
      ]),
    );
    expect(parsed).toEqual({
      ok: true,
      values: {
        kind: "estimate",
        items: [{ name: "Labour", quantity: 2, unitPrice: 45.5 }],
        total: 91,
        notes: ["the email has two problems"],
      },
    });
  });

  it("AC-DOCAI-08: невідома категорія чи нечислова кількість — значення не приймаються", () => {
    expect(
      confirmedValuesFrom(
        form([
          ["kind", "request"],
          ["description", "Door lock is broken"],
          ["category", "gardening"],
          ["urgency", "urgent"],
        ]),
      ).ok,
    ).toBe(false);
    expect(
      confirmedValuesFrom(
        form([
          ["kind", "estimate"],
          ["item_name", "Labour"],
          ["item_quantity_0", "two"],
          ["item_unit_price_0", "45"],
        ]),
      ).ok,
    ).toBe(false);
  });

  it("AC-DOCAI-08: час підтвердження — за Києвом, DD.MM.YYYY HH:MM", () => {
    expect(formatConfirmedAt("2026-11-16T09:05:00Z")).toBe("16.11.2026 11:05");
  });
});
