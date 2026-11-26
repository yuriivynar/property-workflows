// @vitest-environment jsdom
// Помилка поля (ADR 0012): під полем із role="alert"; щойно поле змінили — зникає й знімає aria-invalid.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FieldError } from "./field-error";

afterEach(cleanup);

describe("FieldError", () => {
  it("AC-RUN-03: «Enter a case name» під полем; після введення помилка зникає, aria-invalid знято", () => {
    render(
      <>
        <input id="case_name" aria-invalid aria-describedby="launch-error" />
        <FieldError id="launch-error" fieldId="case_name">
          Enter a case name
        </FieldError>
      </>,
    );
    expect(screen.getByRole("alert").textContent).toBe("Enter a case name");
    const field = screen.getByRole("textbox");

    fireEvent.input(field, { target: { value: "Apartment 7, leak" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(field.getAttribute("aria-invalid")).toBeNull();
    expect(field.getAttribute("aria-describedby")).toBeNull();
  });
});
