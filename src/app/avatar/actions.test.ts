// Фото профілю: вхід до запису, лише PNG/JPG до 2 МБ, шлях — у своїй теці (рішення власника 2026-11-26, ADR 0012).
import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "10000000-0000-4000-8000-0000000000d1";
const state = vi.hoisted(() => ({
  claims: { sub: "" } as { sub: string } | null,
  profile: { role: "manager", avatar_url: null as string | null } as { role: string; avatar_url: string | null } | null,
  upload: vi.fn(async () => ({ error: null })),
  remove: vi.fn(async () => ({ error: null })),
  update: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: state.claims } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }) }),
      update: (values: unknown) => {
        state.update(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
    storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
  }),
}));

const { uploadAvatar, removeAvatar } = await import("./actions");

const form = (file?: File) => {
  const data = new FormData();
  if (file) data.set("photo", file);
  return data;
};

describe("uploadAvatar / removeAvatar", () => {
  beforeEach(() => {
    state.claims = { sub: ME };
    state.profile = { role: "manager", avatar_url: null };
    state.upload.mockClear();
    state.remove.mockClear();
    state.update.mockClear();
  });

  it("не увійшов — нічого не завантажено", async () => {
    state.claims = null;
    expect((await uploadAvatar(form(new File(["x"], "a.png", { type: "image/png" })))).ok).toBe(false);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("не PNG/JPG — «Choose a PNG or JPG image», нічого не завантажено", async () => {
    expect(await uploadAvatar(form(new File(["x"], "a.gif", { type: "image/gif" })))).toEqual({
      ok: false,
      message: "Choose a PNG or JPG image",
    });
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("PNG — у власну теку, avatar_url оновлено, старе фото прибрано", async () => {
    state.profile = { role: "manager", avatar_url: `${ME}/avatar-1.png` };
    expect(await uploadAvatar(form(new File(["x"], "a.png", { type: "image/png" })))).toEqual({ ok: true, message: "Photo saved" });
    const [path] = state.upload.mock.calls[0] as unknown as [string];
    expect(path.startsWith(`${ME}/avatar-`)).toBe(true);
    expect(state.update).toHaveBeenCalledWith({ avatar_url: path });
    expect(state.remove).toHaveBeenCalledWith([`${ME}/avatar-1.png`]);
  });

  it("«Remove photo» — avatar_url = null і файл прибрано", async () => {
    state.profile = { role: "manager", avatar_url: `${ME}/avatar-1.png` };
    expect((await removeAvatar()).ok).toBe(true);
    expect(state.update).toHaveBeenCalledWith({ avatar_url: null });
    expect(state.remove).toHaveBeenCalledWith([`${ME}/avatar-1.png`]);
  });
});
