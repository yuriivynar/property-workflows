// Хто відкрив сторінку: роль лише з профілю, email — з профілю або JWT, фото — лише своє (ADR 0012).
import { describe, expect, it } from "vitest";
import { toViewer } from "./viewer-data";

describe("toViewer", () => {
  it("профіль є — email, роль і фото з профілю", () => {
    expect(toViewer({ sub: "u1", email: "jwt@example.test" }, { email: "a@example.test", role: "admin", avatar_url: "u1/a.png" })).toEqual({
      userId: "u1",
      email: "a@example.test",
      role: "admin",
      avatarPath: "u1/a.png",
    });
  });

  it("профілю немає — email з JWT, ролі й фото немає", () => {
    expect(toViewer({ sub: "u1", email: "jwt@example.test" }, null)).toEqual({ userId: "u1", email: "jwt@example.test", role: null, avatarPath: null });
    expect(toViewer({ sub: "u1", email: 42 }, null).email).toBeNull();
  });
});
