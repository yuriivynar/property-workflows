// @vitest-environment jsdom
// Вибір «Theme» у меню користувача, Sheet телефону й на сторінці Profile (ADR 0012): ті самі перевірки AC-DSYS-05/06,
// що й для меню на вході (theme-switch.test.tsx), — обрана тема відмічена, вибір пише cookie й data-theme на <html>.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeChoice } from "./theme-choice";
import { initialsOf, UserMenu } from "./user-menu";

const signOut = async () => {};

afterEach(() => {
  cleanup();
  document.cookie = "theme=; Max-Age=0; Path=/";
  delete document.documentElement.dataset.theme;
});

async function openMenu(theme: "system" | "light" | "dark") {
  render(<UserMenu email="manager.a@example.test" role="manager" theme={theme} signOut={signOut} />);
  fireEvent.click(screen.getByTestId("user-menu"));
  return within(await screen.findByRole("menu"));
}

describe("Меню користувача: вибір «Theme»", () => {
  it("AC-DSYS-05: тему не обрано — у меню рядок «Theme», обрано «Theme: System», поруч Light і Dark", async () => {
    const menu = await openMenu("system");

    expect(menu.getByText("Theme")).toBeTruthy();
    expect(menu.getByRole("menuitemradio", { name: "Theme: System" }).getAttribute("aria-checked")).toBe("true");
    expect(menu.getByRole("menuitemradio", { name: "Theme: Light" }).getAttribute("aria-checked")).toBe("false");
    expect(menu.getByRole("menuitemradio", { name: "Theme: Dark" }).getAttribute("aria-checked")).toBe("false");
  });

  it("AC-DSYS-06: вибір «Light» у меню — cookie на пристрої й data-theme=light; після відновлення з cookie обрано Light", async () => {
    const menu = await openMenu("system");
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Theme: Light" }));

    expect(document.cookie).toContain("theme=light");
    expect(document.documentElement.dataset.theme).toBe("light");
    cleanup();

    const restored = await openMenu("light");
    expect(restored.getByRole("menuitemradio", { name: "Theme: Light" }).getAttribute("aria-checked")).toBe("true");
    expect(restored.getByRole("menuitemradio", { name: "Theme: System" }).getAttribute("aria-checked")).toBe("false");
  });

  it("у меню — Profile і Sign out", async () => {
    const menu = await openMenu("dark");
    expect(menu.getByRole("menuitem", { name: "Profile" })).toBeTruthy();
    expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("аватар — ініціали власного email", () => {
    expect(initialsOf("manager.a@example.test")).toBe("MA");
    expect(initialsOf("vendor@example.test")).toBe("VE");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("Profile і Sheet телефону: вибір «Theme» радіокнопками", () => {
  it("AC-DSYS-05: на Profile — група «Theme» зі словами System · Light · Dark, обрано System", () => {
    render(<ThemeChoice value="system" name="theme-profile" variant="labelled" />);
    const group = within(screen.getByRole("radiogroup", { name: "Theme" }));

    expect((group.getByRole("radio", { name: "System" }) as HTMLInputElement).checked).toBe(true);
    expect((group.getByRole("radio", { name: "Light" }) as HTMLInputElement).checked).toBe(false);
    expect((group.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(false);
  });

  it("AC-DSYS-06: у Sheet (лише іконки) — «Theme: Dark» пише cookie й data-theme=dark", () => {
    render(<ThemeChoice value="system" name="theme-sheet" />);
    fireEvent.click(screen.getByRole("radio", { name: "Theme: Dark" }));

    expect((screen.getByRole("radio", { name: "Theme: Dark" }) as HTMLInputElement).checked).toBe(true);
    expect(document.cookie).toContain("theme=dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
