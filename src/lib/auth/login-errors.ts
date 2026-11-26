// Повідомлення сторінки входу за ?error=… (інтерфейс англійською — «Припущення» PM). Лише власні ключі: ?error=constructor
// чи ?error=toString інакше повернули б функцію з Object.prototype і зламали б сторінку (рев'ю 2026-11-26).
const LOGIN_ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "The email or password is not correct.",
};

export function loginErrorMessage(error: string | string[] | undefined): string | undefined {
  return typeof error === "string" && Object.hasOwn(LOGIN_ERRORS, error) ? LOGIN_ERRORS[error] : undefined;
}
