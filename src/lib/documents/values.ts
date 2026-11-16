import { z } from "zod";
import { CATEGORIES, ItemSchema, URGENCIES, type Item, type Proposal } from "@/lib/ai/schema";

// AI-розбір документа (openspec/specs/document-parsing): правила, які перевіряє КОД, а не лише промпт.
// Модель пропонує, цей модуль перевіряє й формулює: телефон, сума кошторису й попередження, тексти відмови,
// приміток і стану «недоступний». Чистий модуль — його імпортують сторінка, Server Actions, тести й живий eval.

/** Тексти інтерфейсу — дослівно з solomchaak/property-workflows-spec#40 і варіантів A питань #52, #54. */
export const DOCUMENT_MESSAGES = {
  /** AC-DOCAI-09 — golden case 9. */
  refused: "This document is not a maintenance request or an estimate.",
  /** AC-DOCAI-13 — рішення PM solomchaak/property-workflows-spec#52. */
  unavailable: "The assistant is not available now. Fill in the values yourself.",
  /** AC-DOCAI-06 — позначка біля порожнього поля. */
  notFound: "not found",
  /** AC-DOCAI-07 — рішення PM solomchaak/property-workflows-spec#54. */
  twoProblems: "the email has two problems",
  /** AC-DOCAI-10 — golden case 10. */
  instructionsIgnored: "the text contains instructions to the AI that were ignored",
} as const;

/** Найдовший текст, який приймає форма (символів). Моделі йде не більше MAX_DOCUMENT_CHARS з промпту. */
export const MAX_INPUT_CHARS = 20_000;

/**
 * Телефон у формі «555-0103» (AC-DOCAI-01, golden case 3): 7 цифр → «ddd-dddd», 10 цифр → «ddd-ddd-dddd»;
 * інший запис лишаємо як є (людина виправить). Порожнє — null («not found», AC-DOCAI-06).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return text;
}

const cents = (amount: number) => Math.round(amount * 100);
const money = (centsValue: number) => (centsValue / 100).toFixed(2);

/** Сума позицій кошторису в центах: кожна позиція — кількість × ціна за одиницю, округлено до цента. */
export function itemsTotalCents(items: readonly Item[]): number {
  return items.reduce((sum, item) => sum + cents(item.quantity * item.unitPrice), 0);
}

/**
 * Попередження, коли сума позицій не дорівнює вказаній загальній сумі (AC-DOCAI-08, golden case 8). Рахує код, а не
 * модель; числа документа не змінюємо. Немає позицій чи вказаної суми — попередження немає.
 */
export function totalWarning(items: readonly Item[], total: number | null): string | null {
  if (total === null || items.length === 0) return null;
  const sum = itemsTotalCents(items);
  if (sum === cents(total)) return null;
  return `items add up to ${money(sum)}, the stated total is ${money(cents(total))}`;
}

// Типові інструкції для AI всередині документа. Код шукає їх сам: примітка AC-DOCAI-10 з'являється, навіть якщо модель
// прапорця instructionsIgnored не поставила. Модель усе одно бачить текст лише як дані між тегами <document>.
const INSTRUCTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b[^.!?\n]{0,40}\b(instructions?|rules|prompts?|guidelines)\b/i,
  /\bsystem prompt\b/i,
  /\byou are now\b/i,
  /\b(act|behave) as\b[^.!?\n]{0,20}\b(assistant|ai|model|admin)\b/i,
];

export function containsInstructionsToAi(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));
}

/** Що бачить людина після розбору: значення для перевірки, примітки, попередження — або відмова. */
export type ProposalView =
  | { state: "refused"; message: string }
  | {
      state: "proposed";
      kind: "request" | "estimate";
      phone: string | null;
      description: string | null;
      category: Proposal["category"];
      urgency: Proposal["urgency"];
      items: Item[];
      total: number | null;
      warning: string | null;
      notes: string[];
    };

/**
 * Пропозиція моделі → те, що показуємо людині (AC-DOCAI-01, -02, -06…-10). `refused` — жодних значень і текст
 * відмови. `needs_info` — звернення без названої проблеми: показуємо порожні поля з «not found» для ручного вводу.
 */
export function toProposalView(proposal: Proposal, documentText: string): ProposalView {
  if (proposal.status === "refused" || proposal.kind === null) {
    return { state: "refused", message: DOCUMENT_MESSAGES.refused };
  }

  // Примітки PM — точні (вимога #59): у звичайному зверненні й кошторисі лише сталі примітки коду. Власна примітка моделі
  // (назва небезпеки, golden case 6) — лише для звернення, яке модель позначила терміновим.
  const modelNotes = proposal.kind === "request" && proposal.urgency === "urgent" ? proposal.notes : [];
  const notes = modelNotes.map((note) => note.trim()).filter(Boolean);
  if (proposal.kind === "request" && proposal.twoProblems) notes.push(DOCUMENT_MESSAGES.twoProblems);
  if (proposal.instructionsIgnored || containsInstructionsToAi(documentText)) {
    notes.push(DOCUMENT_MESSAGES.instructionsIgnored);
  }
  const uniqueNotes = [...new Set(notes)];

  if (proposal.kind === "estimate") {
    return {
      state: "proposed",
      kind: "estimate",
      phone: null,
      description: null,
      category: null,
      urgency: null,
      items: proposal.items,
      total: proposal.total,
      warning: totalWarning(proposal.items, proposal.total),
      notes: uniqueNotes,
    };
  }

  const needsInfo = proposal.status === "needs_info";
  return {
    state: "proposed",
    kind: "request",
    phone: normalizePhone(proposal.phone),
    description: needsInfo ? null : proposal.description?.trim() || null,
    category: needsInfo ? null : proposal.category,
    urgency: needsInfo ? null : proposal.urgency,
    items: [],
    total: null,
    warning: null,
    notes: uniqueNotes,
  };
}

// Значення, які людина підтверджує кнопкою «Save values» (AC-DOCAI-04). Сервер перевіряє їх ще раз: клієнт може
// надіслати що завгодно, а пропозицію моделі людина могла змінити чи ввести вручну (AC-DOCAI-13).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

// До 5 приміток моделі (ProposalSchema) + 2 сталі примітки коду (twoProblems, instructionsIgnored, toProposalView):
// людина зберігає все, що їй показали.
const NotesSchema = z.array(z.string().trim().min(1).max(200)).max(7);

export const RequestValuesSchema = z.object({
  kind: z.literal("request"),
  phone: optionalText(40),
  description: z.string().trim().min(1).max(500),
  category: z.enum(CATEGORIES),
  urgency: z.enum(URGENCIES),
  notes: NotesSchema,
});

export const EstimateValuesSchema = z.object({
  kind: z.literal("estimate"),
  items: z.array(ItemSchema).min(1).max(50),
  total: z.number().nonnegative().max(100_000_000).nullable(),
  notes: NotesSchema,
});

export const ConfirmedValuesSchema = z.discriminatedUnion("kind", [RequestValuesSchema, EstimateValuesSchema]);
export type ConfirmedValues = z.infer<typeof ConfirmedValuesSchema>;

/** Що зберігаємо: значення людини + те, що рахує код (телефон у формі, попередження про суму). */
export type StoredValues =
  | (z.infer<typeof RequestValuesSchema> & { phone: string | null })
  | (z.infer<typeof EstimateValuesSchema> & { warning: string | null });

export function toStoredValues(values: ConfirmedValues): StoredValues {
  if (values.kind === "request") return { ...values, phone: normalizePhone(values.phone) };
  return { ...values, warning: totalWarning(values.items, values.total) };
}
