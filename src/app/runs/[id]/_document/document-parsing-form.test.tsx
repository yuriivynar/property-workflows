// @vitest-environment jsdom
// Блок «Parse a document» на рівні інтерфейсу: що бачить людина після розбору — відмову без значень (AC-DOCAI-07),
// «недоступний» з порожньою формою для ручного вводу (AC-DOCAI-09), «not found» біля порожніх полів (AC-DOCAI-02),
// попередження про суму (AC-DOCAI-06) і що лише «Save values» надсилає значення (AC-DOCAI-08). Дії — моки.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyView, type ParseState, type SaveState } from "@/lib/documents/form";
import { DOCUMENT_MESSAGES } from "@/lib/documents/values";
import { DocumentParsingForm } from "./document-parsing-form";

const RUN = "20000000-0000-4000-8000-000000000001";

afterEach(() => {
  cleanup();
});

async function parseWith(result: ParseState, confirm = vi.fn(async (): Promise<SaveState> => ({ status: "idle" }))) {
  const request = vi.fn(async () => result);
  render(<DocumentParsingForm runId={RUN} requestAction={request} confirmAction={confirm} />);
  fireEvent.change(screen.getByLabelText("Document text"), { target: { value: result.text || "Some text" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Parse document" }));
  });
  return { request, confirm };
}

describe("DocumentParsingForm", () => {
  it("AC-DOCAI-07: не звернення й не кошторис — текст відмови, жодних значень і без «Save values»", async () => {
    await parseWith({ status: "refused", text: "The pool opens on Monday.", message: DOCUMENT_MESSAGES.refused });

    expect(screen.getByTestId("document-notice").textContent).toBe(
      "This document is not a maintenance request or an estimate.",
    );
    expect(screen.queryByTestId("document-values-form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save values" })).toBeNull();
  });

  it("AC-DOCAI-09: помічник недоступний — текст стану й порожня форма для ручного вводу без «not found»", async () => {
    await parseWith({ status: "unavailable", text: "Kitchen tap", message: DOCUMENT_MESSAGES.unavailable });

    expect(screen.getByTestId("document-notice").textContent).toBe(
      "The assistant is not available now. Fill in the values yourself.",
    );
    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Save values" })).toBeTruthy();
    expect(screen.queryByText(/not found/)).toBeNull();
    // Вставлений текст лишається в полі.
    expect((screen.getByLabelText("Document text") as HTMLTextAreaElement).value).toBe("Kitchen tap");
  });

  it("AC-DOCAI-02: поле, якого немає в документі, позначено «not found»", async () => {
    await parseWith({
      status: "proposed",
      text: "Kitchen tap in apartment 12 drips.",
      view: { ...emptyView(), description: "Kitchen tap in apartment 12 drips", category: "plumbing", urgency: "not urgent" },
    });

    expect(screen.getByText("Phone").textContent).toContain("not found");
    expect(screen.getByText("Description").textContent).not.toContain("not found");
    expect((screen.getByLabelText(/^Description/) as HTMLInputElement).value).toBe("Kitchen tap in apartment 12 drips");
  });

  it("AC-DOCAI-06: позиції не дають вказаної суми — попередження, числа документа не змінено", async () => {
    await parseWith({
      status: "proposed",
      text: "Estimate",
      view: {
        ...emptyView("estimate"),
        items: [
          { name: "Labour", quantity: 2, unitPrice: 45 },
          { name: "Washer", quantity: 1, unitPrice: 5 },
        ],
        total: 100,
        warning: "items add up to 95.00, the stated total is 100.00",
      },
    });

    expect(screen.getByTestId("document-warning").textContent).toBe("items add up to 95.00, the stated total is 100.00");
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).value).toBe("100");
  });

  it("AC-DOCAI-08: значення надсилає лише «Save values» — розбір сам нічого не підтверджує", async () => {
    const { confirm } = await parseWith({
      status: "proposed",
      text: "Kitchen tap",
      view: { ...emptyView(), phone: "555-0101", description: "Kitchen tap drips", category: "plumbing", urgency: "not urgent" },
    });
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Kitchen tap drips, apartment 12" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });

    expect(confirm).toHaveBeenCalledOnce();
    const sent = confirm.mock.calls[0] as unknown as [SaveState, FormData];
    expect(sent[1].get("description")).toBe("Kitchen tap drips, apartment 12");
    expect(sent[1].get("run_id")).toBe(RUN);
  });
});
