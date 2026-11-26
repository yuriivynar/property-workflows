// @vitest-environment jsdom
// AuthHero — декоративна панель входу. Кнопку паузи видно лише при наведенні, фокусі, на паузі й на сенсорних екранах,
// але вона завжди в DOM і доступна з клавіатури (WCAG 2.2.2: рух довший за 5 с має зупинятися). Назви тестів без AC ID —
// технічна перевірка, а не критерій PM.
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AuthHero } from "./auth-hero"

afterEach(() => {
  cleanup()
})

describe("AuthHero", () => {
  it("кнопка паузи прихована візуально до наведення чи фокусу, але лишається кнопкою в DOM", () => {
    render(<AuthHero />)
    const button = screen.getByRole("button", { name: "Pause animation" })
    expect(button.className).toContain("opacity-0")
    for (const cls of ["group-hover:opacity-100", "focus-visible:opacity-100", "aria-pressed:opacity-100", "[@media(hover:none)]:opacity-100"]) {
      expect(button.className).toContain(cls)
    }
  })

  it("натискання ставить рух на паузу і повертає його", () => {
    const { container } = render(<AuthHero />)
    const hero = container.querySelector('[data-slot="auth-hero"]')
    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }))
    expect(screen.getByRole("button", { name: "Play animation" }).getAttribute("aria-pressed")).toBe("true")
    expect(hero?.getAttribute("data-paused")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Play animation" }))
    expect(hero?.getAttribute("data-paused")).toBe("false")
  })
})
