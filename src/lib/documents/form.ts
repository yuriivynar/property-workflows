import { ConfirmedValuesSchema, MAX_INPUT_CHARS, type ConfirmedValues, type ProposalView } from "./values";

// Блок «Parse a document» на сторінці запуску (openspec/changes/impl-document-parsing/design.md, «UI»): стани блоку й
// розбір форми «Save values». Чистий модуль без Supabase і моделі — його імпортують Server Actions, клієнтський
// компонент і тести.

/** Написи блоку. Повідомлення AC — у DOCUMENT_MESSAGES (дослівно з #40 і варіантів A). */
export const DOCUMENT_LABELS = {
  title: "Parse a document",
  hint: "Paste a maintenance request or a contractor's estimate. The assistant suggests values; nothing is saved until you select Save values.",
  documentText: "Document text",
  parse: "Parse document",
  parsing: "Reading the document. This usually takes 5 to 30 seconds.",
  save: "Save values",
  saved: "Values saved",
  request: "Maintenance request",
  estimate: "Estimate",
  kind: "Document type",
  phone: "Phone",
  description: "Description",
  category: "Category",
  urgency: "Urgency",
  items: "Line items",
  item: "Item",
  quantity: "Quantity",
  unitPrice: "Unit price",
  total: "Total",
  addItem: "Add item",
  removeItem: "Remove",
  notes: "Notes",
  savedTitle: "Document values",
  confirmedBy: "Confirmed by",
  choose: "Choose",
} as const;

/** Помилки форми, яких немає в AC: нейтральні, у тоні «Вигляд і тон» (без «Oops», без звинувачень). */
export const DOCUMENT_ERRORS = {
  emptyText: "Paste the text of a document",
  tooLong: `The text must be at most ${MAX_INPUT_CHARS} characters`,
  invalidValues: "Check the values: a request needs a description, a category and an urgency; an estimate needs at least one line item",
  notAllowed: "Not enough rights",
  unexpected: "Something went wrong. Try again.",
  loadFailed: "Saved values could not be loaded. Reload the page.",
} as const;

type ProposedView = Extract<ProposalView, { state: "proposed" }>;

/** Стан після «Parse document». `text` повертаємо, щоб вставлений текст лишався в полі. */
export type ParseState =
  | { status: "idle"; text: string }
  | { status: "error"; text: string; message: string }
  /** AC-DOCAI-09: помічник недоступний — порожня форма для ручного вводу. */
  | { status: "unavailable"; text: string; message: string }
  /** AC-DOCAI-07: не звернення й не кошторис — жодних значень. */
  | { status: "refused"; text: string; message: string }
  | { status: "proposed"; text: string; view: ProposedView };

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; message: string };

export const INITIAL_PARSE_STATE: ParseState = { status: "idle", text: "" };
export const INITIAL_SAVE_STATE: SaveState = { status: "idle" };

/** Текст документа з форми: обрізаний; порожній або задовгий — помилка до виклику моделі. */
export function documentTextFrom(formData: FormData): { ok: true; text: string } | { ok: false; text: string; message: string } {
  const raw = formData.get("document_text");
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: false, text, message: DOCUMENT_ERRORS.emptyText };
  if (text.length > MAX_INPUT_CHARS) return { ok: false, text: text.slice(0, MAX_INPUT_CHARS), message: DOCUMENT_ERRORS.tooLong };
  return { ok: true, text };
}

/** Порожні значення для ручного вводу, коли помічник недоступний (AC-DOCAI-09; варіант A #52). */
export function emptyView(kind: "request" | "estimate" = "request"): ProposedView {
  return {
    state: "proposed",
    kind,
    phone: null,
    description: null,
    category: null,
    urgency: null,
    items: [],
    total: null,
    warning: null,
    notes: [],
  };
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/** Число з поля: порожнє — null; кома як десятковий роздільник; не число — NaN (zod його відхилить). */
function numberOrNull(raw: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!value) return null;
  return Number(value);
}

/**
 * Значення, які людина підтвердила кнопкою «Save values» (AC-DOCAI-08), — з полів форми, а не з відповіді моделі:
 * людина могла їх змінити чи ввести вручну (AC-DOCAI-09). Порожній рядок позиції (усі три поля порожні) пропускаємо.
 */
export function confirmedValuesFrom(formData: FormData): { ok: true; values: ConfirmedValues } | { ok: false } {
  const notes = formData
    .getAll("notes")
    .filter((note): note is string => typeof note === "string")
    .map((note) => note.trim())
    .filter(Boolean);

  const kind = text(formData, "kind");
  const candidate =
    kind === "estimate"
      ? {
          kind,
          items: formData
            .getAll("item_name")
            .map((name, i) => ({
              name: typeof name === "string" ? name : "",
              quantity: text(formData, `item_quantity_${i}`),
              unitPrice: text(formData, `item_unit_price_${i}`),
            }))
            .filter((item) => item.name.trim() || item.quantity.trim() || item.unitPrice.trim())
            .map((item) => ({ name: item.name, quantity: numberOrNull(item.quantity), unitPrice: numberOrNull(item.unitPrice) })),
          total: numberOrNull(text(formData, "total")),
          notes,
        }
      : {
          kind,
          phone: text(formData, "phone"),
          description: text(formData, "description"),
          category: text(formData, "category"),
          urgency: text(formData, "urgency"),
          notes,
        };

  const parsed = ConfirmedValuesSchema.safeParse(candidate);
  return parsed.success ? { ok: true, values: parsed.data } : { ok: false };
}

/** Дата підтвердження за Києвом, DD.MM.YYYY HH:MM (DESIGN.md, «Типографіка»). */
export function formatConfirmedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")} ${part("hour")}:${part("minute")}`;
}
