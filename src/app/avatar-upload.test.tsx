// @vitest-environment jsdom
// Фото профілю: клік по аватару — меню (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const removeAvatar = vi.fn(async () => ({ ok: true, message: "Photo removed" }));
vi.mock("./avatar/actions", () => ({
  uploadAvatar: vi.fn(async () => ({ ok: true, message: "Photo saved" })),
  removeAvatar: () => removeAvatar(),
}));

const { AvatarUpload } = await import("./avatar-upload");

afterEach(cleanup);

async function openMenu(hasPhoto: boolean) {
  render(<AvatarUpload email="manager.a@example.test" src={null} hasPhoto={hasPhoto} />);
  fireEvent.click(screen.getByTestId("avatar-menu"));
  return within(await screen.findByRole("menu"));
}

describe("Profile: меню фото", () => {
  it("є фото — аватар «Change your photo», у меню «Replace photo» і «Remove photo»", async () => {
    expect((await openMenu(true)).getByRole("menuitem", { name: "Replace photo" })).toBeTruthy();
    expect(screen.getByTestId("avatar-menu").getAttribute("aria-label")).toBe("Change your photo");
    expect(screen.getByRole("menuitem", { name: "Remove photo" })).toBeTruthy();
  });

  it("фото немає — лише «Upload a photo», без «Remove photo»", async () => {
    const menu = await openMenu(false);
    expect(menu.getByRole("menuitem", { name: "Upload a photo" })).toBeTruthy();
    expect(menu.queryByRole("menuitem", { name: "Remove photo" })).toBeNull();
  });

  it("«Remove photo» викликає дію й показує її результат", async () => {
    const menu = await openMenu(true);
    fireEvent.click(menu.getByRole("menuitem", { name: "Remove photo" }));

    expect(await screen.findByText("Photo removed")).toBeTruthy();
    expect(removeAvatar).toHaveBeenCalledTimes(1);
  });

  it("файл не PNG/JPG — повідомлення одразу, без запиту", async () => {
    render(<AvatarUpload email="manager.a@example.test" src={null} hasPhoto={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });

    expect((await screen.findByRole("alert")).textContent).toMatch(/PNG or JPG/);
  });
});
