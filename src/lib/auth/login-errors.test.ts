// Повідомлення сторінки входу: лише відомі коди; ключі Object.prototype не ламають сторінку (рев'ю 2026-11-26).
import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./login-errors";

describe("Вхід: повідомлення за ?error=", () => {
  it("відомі коди — текст", () => {
    expect(loginErrorMessage("invalid")).toBe("The email or password is not correct.");
    expect(loginErrorMessage("missing")).toBe("Enter your email and password.");
  });

  it("constructor, toString, __proto__, масив чи невідоме — без повідомлення", () => {
    for (const value of ["constructor", "toString", "__proto__", "other"]) expect(loginErrorMessage(value)).toBeUndefined();
    expect(loginErrorMessage(["invalid"])).toBeUndefined();
    expect(loginErrorMessage(undefined)).toBeUndefined();
  });
});
