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
    fireEvent.click(screen.getByRole("button", { name: "Propose values" }));
  });
  return { request, confirm };
}

describe("DocumentParsingForm", () => {
  it("AC-DOCAI-09: не звернення й не кошторис — текст відмови, жодних значень і без «Save values»", async () => {
    await parseWith({ status: "refused", text: "The pool opens on Monday.", message: DOCUMENT_MESSAGES.refused });

    expect(screen.getByTestId("document-notice").textContent).toBe(
      "This document is not a maintenance request or an estimate.",
    );
    expect(screen.queryByTestId("document-values-form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save values" })).toBeNull();
  });

  it("AC-DOCAI-13: помічник недоступний — текст стану й порожня форма для ручного вводу без «not found»", async () => {
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

  it("AC-DOCAI-06: поле, якого немає в документі, позначено «not found»", async () => {
    await parseWith({
      status: "proposed",
      text: "Kitchen tap in apartment 12 drips.",
      view: { ...emptyView(), description: "Kitchen tap in apartment 12 drips", category: "plumbing", urgency: "not urgent" },
    });

    expect(screen.getByText("Phone").textContent).toContain("not found");
    expect(screen.getByText("Description").textContent).not.toContain("not found");
    expect((screen.getByLabelText(/^Description/) as HTMLInputElement).value).toBe("Kitchen tap in apartment 12 drips");
  });

  it("AC-DOCAI-08: позиції не дають вказаної суми — попередження, числа документа не змінено", async () => {
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

  it("AC-DOCAI-04: значення надсилає лише «Save values» — розбір сам нічого не підтверджує", async () => {
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
  it("AC-DOCAI-04: помилка збереження не стирає виправлень людини — повторне «Save values» надсилає виправлене", async () => {
    const confirm = vi.fn(async (): Promise<SaveState> => ({ status: "error", message: "Not enough rights" }));
    await parseWith(
      {
        status: "proposed",
        text: "Kitchen tap",
        view: { ...emptyView(), phone: "555-0101", description: "Kitchen tap drips", category: "plumbing", urgency: "not urgent" },
      },
      confirm,
    );
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Kitchen tap drips, apartment 12" } });
    fireEvent.change(screen.getByLabelText(/^Urgency/), { target: { value: "urgent" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });

    expect(screen.getByText("Not enough rights")).toBeTruthy();
    expect((screen.getByLabelText(/^Description/) as HTMLInputElement).value).toBe("Kitchen tap drips, apartment 12");
    expect((screen.getByLabelText(/^Urgency/) as HTMLSelectElement).value).toBe("urgent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save values" }));
    });
    const second = confirm.mock.calls[1] as unknown as [SaveState, FormData];
    expect(second[1].get("description")).toBe("Kitchen tap drips, apartment 12");
    expect(second[1].get("urgency")).toBe("urgent");
  });

  it("AC-DOCAI-01: новий розбір — нова пропозиція, без позицій і суми попереднього кошторису", async () => {
    const estimate = (name: string, total: number): ParseState => ({
      status: "proposed",
      text: name,
      view: { ...emptyView("estimate"), items: [{ name, quantity: 1, unitPrice: total }], total },
    });
    const request = vi
      .fn<(state: ParseState, data: FormData) => Promise<ParseState>>()
      .mockResolvedValueOnce(estimate("Estimate A item", 10))
      .mockResolvedValueOnce(estimate("Estimate B item", 20));
    render(<DocumentParsingForm runId={RUN} requestAction={request} confirmAction={vi.fn()} />);
    for (const text of ["Estimate A", "Estimate B"]) {
      fireEvent.change(screen.getByLabelText("Document text"), { target: { value: text } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Propose values" }));
      });
    }

    expect((screen.getByLabelText(/^Item/) as HTMLInputElement).value).toBe("Estimate B item");
    expect((screen.getByLabelText(/^Total/) as HTMLInputElement).value).toBe("20");
  });
  it("AC-DOCAI-03: поки модель читає документ — кнопка неактивна й aria-busy, замість форми заглушка зі статусом", async () => {
    let finish: (state: ParseState) => void = () => {};
    const request = vi.fn(() => new Promise<ParseState>((resolve) => (finish = resolve)));
    render(<DocumentParsingForm runId={RUN} requestAction={request} confirmAction={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Document text"), { target: { value: "Kitchen tap" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Propose values" }));
    });

    const button = screen.getByRole("button", { name: "Propose values" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Reading the document…");
    expect(screen.getByTestId("document-parsing")).toBeTruthy();

    await act(async () => {
      finish({
        status: "proposed",
        text: "Kitchen tap",
        view: { ...emptyView(), description: "Kitchen tap drips", category: "plumbing", urgency: "not urgent" },
      });
    });
    expect(screen.queryByTestId("document-parsing")).toBeNull();
    expect(screen.getByTestId("document-values-form")).toBeTruthy();
    expect(button.getAttribute("aria-busy")).toBeNull();
  });
  it("AC-DOCAI-05: «Discard» — блок знову порожній, нічого не збережено", async () => {
    const { confirm } = await parseWith({
      status: "proposed",
      text: "Kitchen tap",
      view: { ...emptyView(), phone: "555-0101", description: "Kitchen tap drips", category: "plumbing", urgency: "not urgent" },
    });
    expect(screen.getByTestId("document-values-form")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByTestId("document-values-form")).toBeNull();
    expect((screen.getByLabelText("Document text") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByTestId("document-notice")).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-12: файл «photo.png» через «Upload a text file» — «Only plain text files (.txt) are accepted», значень немає", async () => {
    const request = vi.fn(async (): Promise<ParseState> => ({ status: "idle", text: "" }));
    render(<DocumentParsingForm runId={RUN} requestAction={request} confirmAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Upload a text file" })).toBeTruthy();

    const photo = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("document-file"), { target: { files: [photo] } });
    });

    expect(screen.getByTestId("document-upload-error").textContent).toBe("Only plain text files (.txt) are accepted");
    expect(screen.queryByTestId("document-values-form")).toBeNull();
    expect((screen.getByLabelText("Document text") as HTMLTextAreaElement).value).toBe("");
    expect(request).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-12: файл .txt читається в текстове поле — розібрати можна як вставлений текст", async () => {
    render(<DocumentParsingForm runId={RUN} requestAction={vi.fn()} confirmAction={vi.fn()} />);
    // Тип порожній: так браузер віддає .txt, якщо не визначив тип, — файл однаково приймається.
    const note = new File(["The oven in apartment 5 does not heat up anymore."], "request.txt", { type: "" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("document-file"), { target: { files: [note] } });
    });

    expect((screen.getByLabelText("Document text") as HTMLTextAreaElement).value).toBe(
      "The oven in apartment 5 does not heat up anymore.",
    );
    expect(screen.queryByTestId("document-upload-error")).toBeNull();
  });

  it("AC-DOCAI-11: порожнє поле — повідомлення сервера «Paste the text of a document», значень немає", async () => {
    await parseWith({ status: "error", text: "", message: "Paste the text of a document" });
    expect(screen.getByText("Paste the text of a document")).toBeTruthy();
    expect(screen.queryByTestId("document-values-form")).toBeNull();
  });
  it("AC-DOCAI-12: відхилений файл не прибирає форму значень — виправлення людини лишаються", async () => {
    await parseWith({
      status: "proposed",
      text: "Kitchen tap",
      view: { ...emptyView(), phone: "555-0101", description: "Kitchen tap drips", category: "plumbing", urgency: "not urgent" },
    });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Kitchen tap drips, apartment 12" } });
    const photo = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("document-file"), { target: { files: [photo] } });
    });

    expect(screen.getByTestId("document-upload-error").textContent).toBe("Only plain text files (.txt) are accepted");
    expect((screen.getByLabelText(/^Description/) as HTMLInputElement).value).toBe("Kitchen tap drips, apartment 12");
  });

  it("AC-DOCAI-12: два файли поспіль — у полі текст останнього вибраного, навіть якщо перший читався довше", async () => {
    render(<DocumentParsingForm runId={RUN} requestAction={vi.fn()} confirmAction={vi.fn()} />);
    let finishA: (text: string) => void = () => {};
    const fileA = { name: "a.txt", type: "text/plain", text: () => new Promise<string>((resolve) => (finishA = resolve)) };
    const fileB = { name: "b.txt", type: "text/plain", text: async () => "Document B" };
    await act(async () => {
      fireEvent.change(screen.getByTestId("document-file"), { target: { files: [fileA] } });
      fireEvent.change(screen.getByTestId("document-file"), { target: { files: [fileB] } });
    });
    await act(async () => {
      finishA("Document A");
    });

    expect((screen.getByLabelText("Document text") as HTMLTextAreaElement).value).toBe("Document B");
  });
});
