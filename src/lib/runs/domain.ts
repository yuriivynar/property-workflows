// Доменні правила запусків — чистий TypeScript без Supabase. Остаточно правила виконує база
// (supabase/migrations/…_workflow_runs.sql); тут — перевірка форми до запиту й тексти для людини.
import { MESSAGES, REQUIRED_LABELS } from "./messages";

export const CASE_NAME_MAX_LENGTH = 100;

/** Коди помилок функцій бази (текст винятку) і перевірки форми. */
export type RunErrorCode =
  | "CASE_NAME_REQUIRED"
  | "CASE_NAME_TOO_LONG"
  | "LAUNCH_NOT_ALLOWED"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_VERSION_CHANGED"
  | "INVALID_ASSIGNEE"
  | "NOT_ALLOWED"
  | "CONFIRMATION_REQUIRED"
  | "ANSWER_NOT_ALLOWED"
  | "INVALID_ANSWER";

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
  TEMPLATE_VERSION_CHANGED: MESSAGES.templateVersionChanged,
  INVALID_ASSIGNEE: MESSAGES.invalidAssignee,
  NOT_ALLOWED: MESSAGES.markNotAllowed,
  CONFIRMATION_REQUIRED: MESSAGES.confirmationRequired,
  ANSWER_NOT_ALLOWED: MESSAGES.answerNotAllowed,
  INVALID_ANSWER: MESSAGES.unexpected,
};

// Object.hasOwn, а не `in`: інакше `?error=__proto__` чи `constructor` з URL пройшли б як «код» (ключі прототипу).
const isRunErrorCode = (value: string): value is RunErrorCode => Object.hasOwn(MESSAGE_BY_CODE, value);

/** Код помилки з тексту помилки Supabase (функції бази кидають винятки з кодом у тексті). */
export function errorCodeFrom(message: string | null | undefined): RunErrorCode | undefined {
  const match = (message ?? "").match(/[A-Z_]{6,}/g)?.find(isRunErrorCode);
  return match;
}

/** Текст для людини за кодом помилки; невідомий код — загальне повідомлення. */
export function messageForError(code: string | null | undefined): string {
  return code && isRunErrorCode(code) ? MESSAGE_BY_CODE[code] : MESSAGES.unexpected;
}

/** Код помилки з адреси сторінки (?error=…): лише один рядок, інакше — немає. */
export function errorParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Повідомлення на сторінці запуску вендора після відмови позначки: на запуску з його задачами — текст відмови
 * (для NOT_ALLOWED — текст AC-TASK-03, AC-VENDOR-07); на запуску без його задач — нічого, лише «Run not found», щоб
 * сторінка не підказувала, що запуск існує (AC-VENDOR-15; рішення PM solomchaak/property-workflows-spec#48).
 */
export function vendorRunNotice(runFound: boolean, errorCode: string | null | undefined): string | undefined {
  if (!runFound || !errorCode) return undefined;
  return messageForError(errorCode);
}

export function requiredLabel(isRequired: boolean): string {
  return isRequired ? REQUIRED_LABELS.required : REQUIRED_LABELS.optional;
}

/**
 * Прогрес запуску: «N of M done», де N — задачі зі статусом done, M — усі задачі запуску, обов'язкові й ні
 * (AC-TASK-05, AC-TASK-09; глосарій PM, «Progress»).
 */
export function formatProgress(done: number, total: number): string {
  return `${done} of ${total} done`;
}

/**
 * Прогрес вендора: «Your tasks: N of K done» — лише його задачі в цьому запуску, K — їх кількість, N — «done»
 * (AC-VENDOR-03, AC-VENDOR-05; «Припущення» PM у requirements/39-assign-a-vendor.md).
 */
export function formatYourTasks(done: number, total: number): string {
  return `Your tasks: ${formatProgress(done, total)}`;
}

/** Задачі вендора, згруповані за розділами в порядку запуску (AC-VENDOR-04): розділи без його задач не показуємо. */
export function groupBySection<T extends { section_name: string; section_position: number }>(
  tasks: readonly T[],
): { name: string; position: number; tasks: T[] }[] {
  const sections = new Map<number, { name: string; position: number; tasks: T[] }>();
  for (const task of tasks) {
    const section = sections.get(task.section_position) ?? { name: task.section_name, position: task.section_position, tasks: [] };
    section.tasks.push(task);
    sections.set(task.section_position, section);
  }
  return [...sections.values()].sort((a, b) => a.position - b.position);
}

/**
 * Чи показувати кнопку позначки: виконавець задачі, менеджер запуску або адміністратор (AC-TASK-01, AC-TASK-02,
 * AC-TASK-07). Лише для інтерфейсу — остаточно вирішує функція бази mark_task_done (AC-TASK-03). Правило те саме, що
 * в private.mark_task_done: «менеджер запуску» — лише з роллю manager (колишнього менеджера, якого понизили до вендора,
 * база не пустить, тож кнопку не показуємо). Збіг доводить tests/db/rule-parity.test.ts на всій матриці.
 */
export function canMarkTask(input: {
  userId: string;
  role: string | null | undefined;
  runManagerId: string;
  assigneeId: string;
  status: string;
}): boolean {
  if (input.status === "done") return false;
  return (
    input.role === "admin" ||
    (input.role === "manager" && input.userId === input.runManagerId) ||
    input.userId === input.assigneeId
  );
}

/** Підпис колеги у виборі виконавця й біля задачі — лише email (рішення PM у solomchaak/property-workflows-spec#5; AC-RUN-10, AC-TASK-11). */
export function staffLabel(person: { email: string | null }): string {
  return person.email ?? "";
}

/**
 * Чи потрібне підтвердження позначки: лише для останньої обов'язкової задачі «to do» — тієї, що завершить запуск
 * (рішення PM у solomchaak/property-workflows-spec#15; AC-TASK-04, AC-TASK-16). Решту задач позначають одразу
 * (AC-TASK-01, AC-TASK-02, AC-TASK-07).
 */
export function needsConfirmation(
  tasks: { id: string; is_required: boolean; status: string; is_shown?: boolean }[],
  taskId: string,
): boolean {
  // Прихована умовою задача не рахується й не блокує завершення (AC-LOGIC-03; MODIFIED «Завершення запуску»).
  const shown = tasks.filter((t) => t.is_shown !== false);
  const task = shown.find((t) => t.id === taskId);
  if (!task || !task.is_required || task.status === "done") return false;
  return shown.every((t) => t.id === taskId || !t.is_required || t.status === "done");
}

/**
 * Хто змінює відповідь на поле запуску: менеджер запуску (роль manager) або адміністратор (AC-LOGIC-02, AC-LOGIC-05).
 * Правило те саме, що в private.set_run_field_answer; остаточно вирішує база.
 */
export function canChangeAnswer(input: { userId: string; role: string | null | undefined; runManagerId: string }): boolean {
  return input.role === "admin" || (input.role === "manager" && input.userId === input.runManagerId);
}

/**
 * Підпис відповіді в інтерфейсі — з великої літери («Urgent», «Not urgent»); зберігається й порівнюється відповідь як у
 * тексті PM — `urgent` / `not urgent` (рішення власника 2026-11-26, ADR 0012).
 */
export function answerLabel(answer: string): string {
  return answer.charAt(0).toUpperCase() + answer.slice(1);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ідентифікатор із форми чи адреси — лише UUID; інше відкидаємо ще до запиту до бази. */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Задача з форми належить саме тому запуску, з якого її позначають (рев'ю PR #6: run_id ↔ task_id). */
export function taskBelongsToRun(task: { run_id: string } | null | undefined, runId: string): boolean {
  return Boolean(task) && task!.run_id === runId;
}

/** Список запусків: без жодного видимого запуску — порожній стан із наступною дією, а не порожня таблиця (AC-DSYS-04). */
export function runsListState(runs: readonly unknown[] | null | undefined): "empty" | "table" {
  return runs && runs.length > 0 ? "table" : "empty";
}

/** Вкладки списку запусків (UI v3, рішення власника 2026-11-26): усі, лише «in progress», лише «completed». */
export const RUN_TABS = ["all", "in_progress", "completed"] as const;
export type RunTab = (typeof RUN_TABS)[number];

/** Вкладка з адреси (?status=…): невідоме значення — «all». */
export function runTabParam(value: string | string[] | undefined): RunTab {
  return typeof value === "string" && (RUN_TABS as readonly string[]).includes(value) ? (value as RunTab) : "all";
}

/** Фільтр за назвою випадку з адреси (?q=…): без пробілів на краях, до 100 символів, як і сама назва. */
export function caseQueryParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, CASE_NAME_MAX_LENGTH) : "";
}

/**
 * Запуски за вкладкою й фільтром (без урахування регістру); лічильники вкладок — з урахуванням фільтра за назвою, щоб
 * числа збігалися з тим, що видно після перемикання вкладки.
 */
export function filterRuns<T extends { case_name: string | null; status: string | null }>(
  runs: readonly T[],
  tab: RunTab,
  query: string,
): { rows: T[]; counts: Record<RunTab, number> } {
  const needle = query.toLowerCase();
  const matching = needle ? runs.filter((run) => (run.case_name ?? "").toLowerCase().includes(needle)) : [...runs];
  const counts: Record<RunTab, number> = {
    all: matching.length,
    in_progress: matching.filter((run) => run.status === "in_progress").length,
    completed: matching.filter((run) => run.status === "completed").length,
  };
  return { rows: tab === "all" ? matching : matching.filter((run) => run.status === tab), counts };
}

/** Підсумок запуску для рядка, що розгортається (UI v3, рішення власника 2026-11-26): розділи й наступна задача. */
export interface RunDigest {
  sections: { name: string; done: number; total: number }[];
  next: { name: string; isRequired: boolean; assigneeId: string } | null;
}

/**
 * Прогрес кожного розділу й наступна задача — перша показана задача «to do» в порядку розділів і задач. Приховані
 * умовою задачі не рахуються (AC-LOGIC-01, MODIFIED «Прогрес запуску»); розділ без показаних задач не показуємо.
 */
export function runDigest(
  sections: readonly { id: string; name: string; position: number }[],
  tasks: readonly { section_id: string; name: string; position: number; is_required: boolean; status: string; is_shown: boolean; assignee_id: string }[],
): RunDigest {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const digest: RunDigest = { sections: [], next: null };
  for (const section of ordered) {
    const shown = tasks.filter((task) => task.section_id === section.id && task.is_shown).sort((a, b) => a.position - b.position);
    if (shown.length === 0) continue;
    digest.sections.push({ name: section.name, done: shown.filter((task) => task.status === "done").length, total: shown.length });
    const next = shown.find((task) => task.status !== "done");
    if (next && !digest.next) digest.next = { name: next.name, isRequired: next.is_required, assigneeId: next.assignee_id };
  }
  return digest;
}
