import type { AppRole } from "@/lib/auth/require-role";

// Чисті правила екранів шаблонів (без Supabase) — тестуються окремо (src/lib/templates/domain.test.ts).

/** Тексти екранів шаблонів — дослівно з AC і глосарію PM; робочі рішення — з посиланням на питання PM. */
export const TEMPLATE_MESSAGES = {
  unpublished: "Unpublished changes", // AC-EDITOR-01, глосарій
  needsRequiredTask: "A template needs at least one required task", // AC-EDITOR-04
  notEnoughRights: "Not enough rights", // AC-DSYS-02, AC-EDITOR-07
  backToTemplates: "Back to templates", // AC-DSYS-02
  templateNotFound: "Template not found", // робоче рішення до solomchaak/property-workflows-spec#26
  noChanges: "There are no unpublished changes to save", // робоче рішення до solomchaak/property-workflows-spec#22
  nameRequired: "Enter a name", // робоче рішення до solomchaak/property-workflows-spec#28
  nameTaken: "A template with this name already exists", // робоче рішення до solomchaak/property-workflows-spec#30
  changeNotKept: "Your last change was not kept. Try again.", // робоче рішення до solomchaak/property-workflows-spec#31
  notLoaded: "The data could not be loaded. Try again.",
  noTemplates: "No templates yet.", // загальний випадок; за роллю — нижче (AC-EDITOR-17)
  noTemplatesManager: "No templates yet. An administrator creates them.", // AC-EDITOR-17
  noTemplatesAdmin: "No templates yet. Create a template to start.", // «Припущення» PM, solomchaak/property-workflows-spec#27
  createTemplate: "Create a template",
  templateNameRequired: "Enter a template name", // AC-EDITOR-19
  sectionEmpty: "Every section needs at least one task", // AC-EDITOR-15
  nameMissing: "Every section and task needs a name", // AC-EDITOR-20
  removeSection: "Remove section",
  // Підтвердження: назва розділу й «This cannot be undone» (AC-EDITOR-13).
  confirmRemoveSection: (name: string) => `Remove «${name}» and its tasks? This cannot be undone.`,
  confirmRemoveSectionGroup: "Confirm removing the section",
  cancel: "Cancel",
  launchUnavailable: "Save the template to launch it", // AC-EDITOR-10
  noVersions: "No versions yet. Save the template to create version 1.", // робоче рішення до solomchaak/property-workflows-spec#27
  versionSaved: (n: number) => `Version ${n} saved`, // «Вигляд і тон»: приклад повідомлення про успіх
  version: (n: number) => `Version ${n}`,
} as const;

/** Коди помилок функцій бази й дій → текст для людини. Невідомий код — загальна помилка без деталей. */
export function messageForTemplateError(code: string): string {
  switch (code) {
    case "TEMPLATE_NEEDS_REQUIRED_TASK":
      return TEMPLATE_MESSAGES.needsRequiredTask;
    case "NO_UNPUBLISHED_CHANGES":
      return TEMPLATE_MESSAGES.noChanges;
    case "NOT_ALLOWED":
      return TEMPLATE_MESSAGES.notEnoughRights;
    case "NAME_REQUIRED":
      return TEMPLATE_MESSAGES.nameRequired;
    case "TEMPLATE_NAME_REQUIRED":
      return TEMPLATE_MESSAGES.templateNameRequired;
    case "TEMPLATE_SECTION_EMPTY":
      return TEMPLATE_MESSAGES.sectionEmpty;
    case "TEMPLATE_NAME_MISSING":
      return TEMPLATE_MESSAGES.nameMissing;
    case "NAME_TAKEN":
      return TEMPLATE_MESSAGES.nameTaken;
    case "TEMPLATE_NOT_FOUND":
    case "TEMPLATE_ITEM_NOT_FOUND":
      return TEMPLATE_MESSAGES.templateNotFound;
    default:
      return TEMPLATE_MESSAGES.changeNotKept;
  }
}

/** Код помилки з тексту винятку Postgres (raise exception 'CODE') або з коду Postgres. */
export function templateErrorCode(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "";
  const known = [
    "NAME_TAKEN", // AC-EDITOR-24: save_template_version перевіряє назву під час збереження
    "TEMPLATE_SECTION_EMPTY",
    "TEMPLATE_NAME_MISSING",
    "TEMPLATE_NEEDS_REQUIRED_TASK",
    "NO_UNPUBLISHED_CHANGES",
    "NOT_ALLOWED",
    "TEMPLATE_NOT_FOUND",
    "TEMPLATE_ITEM_NOT_FOUND",
  ];
  const found = known.find((code) => error.message?.includes(code));
  if (found) return found;
  // За назвою обмеження, а не лише за кодом: інший unique / check не має перетворюватись на «назва зайнята».
  const message = error.message ?? "";
  if (error.code === "23505" && /templates_name(_normalized)?_key/.test(message)) return "NAME_TAKEN"; // AC-EDITOR-23
  if (error.code === "23514" && /_name_not_blank/.test(message)) return "NAME_REQUIRED";
  if (error.code === "42501") return "NOT_ALLOWED";
  return "UNEXPECTED";
}

export type TemplatePage = "view" | "edit" | "versions";

/**
 * Хто бачить сторінку шаблону: редактор і список версій — лише адміністратор; менеджер бачить «Not enough rights» і
 * жодних даних (AC-DSYS-02, AC-EDITOR-07). Поточну версію бачать обидві ролі (AC-EDITOR-02).
 */
export function templatePageAccess(role: AppRole, page: TemplatePage): "ok" | "not-enough-rights" {
  if (page === "view") return "ok";
  return role === "admin" ? "ok" : "not-enough-rights";
}

const KYIV = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Kyiv",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Дата й час збереження версії за Києвом у форматі DD.MM.YYYY HH:MM, до хвилини (AC-EDITOR-05). */
export function formatVersionDate(iso: string): string {
  const parts = Object.fromEntries(KYIV.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Порядок списку версій: найновіша перша (AC-EDITOR-05). */
export function newestFirst<T extends { number: number }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => b.number - a.number);
}

/** Назва з форми: обрізані пробіли; порожня — null (форма покаже «Enter a name»). */
export function cleanName(value: FormDataEntryValue | null): string | null {
  const name = typeof value === "string" ? value.trim() : "";
  return name === "" ? null : name;
}

/** Порожній список шаблонів — текст за роллю (AC-EDITOR-17; адміністратору — з «Припущень» PM). */
export function emptyTemplatesMessage(role: AppRole): string {
  return role === "admin" ? TEMPLATE_MESSAGES.noTemplatesAdmin : TEMPLATE_MESSAGES.noTemplatesManager;
}

/**
 * Пункти вибору шаблону у формі запуску: збережений шаблон — доступний; незбережений бачить лише адміністратор —
 * недоступним із приміткою «Save the template to launch it»; менеджеру RLS його не повертає (AC-EDITOR-10).
 */
export function launchOptions(templates: { id: string; name: string; current_version: number | null }[]) {
  return templates.map((t) =>
    t.current_version
      ? { id: t.id, label: t.name, disabled: false }
      : { id: t.id, label: `${t.name} — ${TEMPLATE_MESSAGES.launchUnavailable}`, disabled: true },
  );
}

/** Стан форми «New task»: введена назва, прапорець «Required» і повідомлення над полем (AC-EDITOR-25). */
export type AddTaskFormState = { name: string; required: boolean; message: string | null };

/**
 * Подія відправлення форми «New task»:
 * - saved — задачу записано (name — надіслана назва);
 * - rejected — дія повернула помилку (підтверджена невдача);
 * - unreachable — відповіді немає, бо зв'язок утрачено (результат невідомий; design.md, рішення 5).
 */
export type AddTaskEvent =
  | { type: "saved"; name: string }
  | { type: "rejected"; code: string }
  | { type: "unreachable" };

/**
 * Переходи стану форми. Невдача лишає назву й «Required» у полі та показує повідомлення на тому самому місці: невідомий
 * код і втрата зв'язку — «Your last change was not kept. Try again.» (AC-EDITOR-25), відома відмова — її текст.
 * Успіх очищує поле, лише якщо в ньому досі надіслана назва: нове введення під час відправлення лишається.
 */
export function addTaskFormState(state: AddTaskFormState, event: AddTaskEvent): AddTaskFormState {
  switch (event.type) {
    case "saved":
      return state.name === event.name ? { name: "", required: false, message: null } : { ...state, message: null };
    case "rejected":
      return { ...state, message: messageForTemplateError(event.code) };
    case "unreachable":
      return { ...state, message: TEMPLATE_MESSAGES.changeNotKept };
  }
}

/** Сесія скінчилась — форма веде на сторінку входу, а не показує «not kept» (AC-EDITOR-09, AC-EDITOR-26). */
export function addTaskNeedsSignIn(event: AddTaskEvent): boolean {
  return event.type === "rejected" && event.code === "NOT_SIGNED_IN";
}
