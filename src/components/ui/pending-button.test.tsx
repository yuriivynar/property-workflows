// @vitest-environment jsdom
// PendingButton — кнопка відправлення зі станом «йде відправлення» (DESIGN.md, розділ 6). Нею «Save values» показує, що
// значення ще записуються (AC-DOCAI-08): неактивна, aria-busy, текст дії той самий; друге натискання не надішле значень удруге.
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PendingButton } from "./pending-button"

afterEach(() => {
  cleanup()
})

describe("PendingButton", () => {
  it("AC-DOCAI-08: під час відправлення — неактивна, aria-busy, текст «Save values» не змінюється", () => {
    render(
      <form>
        <PendingButton pending>Save values</PendingButton>
      </form>,
    )
    const button = screen.getByRole("button", { name: "Save values" }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(button.getAttribute("type")).toBe("submit")
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  })

  it("AC-DOCAI-08: поза відправленням — активна, без aria-busy та іконки", () => {
    render(
      <form>
        <PendingButton pending={false}>Save values</PendingButton>
      </form>,
    )
    const button = screen.getByRole("button", { name: "Save values" }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.getAttribute("aria-busy")).toBeNull()
    expect(button.querySelector("svg")).toBeNull()
  })
})
