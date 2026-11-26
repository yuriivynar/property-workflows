// Фото профілю (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, avatarPath, avatarSrc, checkAvatarFile } from "./avatar";

describe("Фото профілю: файл і шлях", () => {
  it("лише PNG чи JPG до 2 МБ", () => {
    expect(checkAvatarFile({ type: "image/png", size: 1000 })).toEqual({ ok: true, extension: "png" });
    expect(checkAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_BYTES })).toEqual({ ok: true, extension: "jpg" });
    expect(checkAvatarFile({ type: "image/gif", size: 10 })).toEqual({ ok: false, message: "Choose a PNG or JPG image" });
    expect(checkAvatarFile({ type: "image/png", size: 0 })).toEqual({ ok: false, message: "Choose a PNG or JPG image" });
    expect(checkAvatarFile(null)).toEqual({ ok: false, message: "Choose a PNG or JPG image" });
    expect(checkAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toEqual({
      ok: false,
      message: "The photo must be at most 2 MB",
    });
  });

  it("шлях — у власній теці; адреса — через /api/avatar", () => {
    expect(avatarPath("u1", "png", 42)).toBe("u1/avatar-42.png");
    expect(avatarSrc("u1/avatar-42.png")).toBe("/api/avatar?v=u1%2Favatar-42.png");
    expect(avatarSrc(null)).toBeNull();
  });
});
