// Доменні правила запусків — чистий TypeScript без Supabase. Остаточно правила виконує база
// (supabase/migrations/…_workflow_runs.sql); тут — перевірка форми до запиту й тексти для людини.
import { MESSAGES, REQUIRED_LABELS, RUN_STATUS_LABELS, TASK_STATUS_LABELS } from "./messages";

export const CASE_NAME_MAX_LENGTH = 100;

/** Коди помилок функцій бази (текст винятку) і перевірки форми. */
export type RunErrorCode =
  | "CASE_NAME_REQUIRED"
  | "CASE_NAME_TOO_LONG"
  | "LAUNCH_NOT_ALLOWED"
  | "TEMPLATE_NOT_FOUND"
  | "INVALID_ASSIGNEE"
  | "NOT_ALLOWED";

export type CaseNameCheck = { ok: true; caseName: string } | { ok: false; code: RunErrorCode };

/**
 * Назва випадку: пробільні символи на краях обрізаємо, далі 1–100 символів
 * (AC-RUN-03, AC-RUN-07; робоче рішення до відповіді на solomchaak/property-workflows-spec#6).
 * Довжину рахуємо в символах Unicode, як char_length у Postgres, а не в одиницях UTF-16.
 */
export function validateCaseName(raw: string | null | undefined): CaseNameCheck {
  const caseName = (raw ?? "").trim();
  if (caseName.length === 0) return { ok: false, code: "CASE_NAME_REQUIRED" };
  if ([...caseName].length > CASE_NAME_MAX_LENGTH) return { ok: false, code: "CASE_NAME_TOO_LONG" };
  return { ok: true, caseName };
}

const MESSAGE_BY_CODE: Record<RunErrorCode, string> = {
  CASE_NAME_REQUIRED: MESSAGES.caseNameRequired,
  CASE_NAME_TOO_LONG: MESSAGES.caseNameTooLong,
  LAUNCH_NOT_ALLOWED: MESSAGES.launchNotAllowed,
  TEMPLATE_NOT_FOUND: MESSAGES.templateNotFound,
  INVALID_ASSIGNEE: MESSAGES.invalidAssignee,
  NOT_ALLOWED: MESSAGES.markNotAllowed,
};

const isRunErrorCode = (value: string): value is RunErrorCode => value in MESSAGE_BY_CODE;

/** Код помилки з тексту помилки Supabase (функції бази кидають винятки з кодом у тексті). */
export function errorCodeFrom(message: string | null | undefined): RunErrorCode | undefined {
  const match = (message ?? "").match(/[A-Z_]{6,}/g)?.find(isRunErrorCode);
  return match;
}

/** Текст для людини за кодом помилки; невідомий код — загальне повідомлення. */
export function messageForError(code: string | null | undefined): string {
  return code && isRunErrorCode(code) ? MESSAGE_BY_CODE[code] : MESSAGES.unexpected;
}

export function runStatusLabel(status: string): string {
  return status in RUN_STATUS_LABELS ? RUN_STATUS_LABELS[status as keyof typeof RUN_STATUS_LABELS] : status;
}

export function taskStatusLabel(status: string): string {
  return status in TASK_STATUS_LABELS ? TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] : status;
}

export function requiredLabel(isRequired: boolean): string {
  return isRequired ? REQUIRED_LABELS.required : REQUIRED_LABELS.optional;
}

/** Підпис колеги у виборі виконавця й біля задачі: ім'я та email (робоче рішення solomchaak/property-workflows-spec#5). */
export function staffLabel(person: { full_name: string | null; email: string | null }): string {
  const email = person.email ?? "";
  return person.full_name ? `${person.full_name} (${email})` : email;
}
