// Дія входу: після входу — на сторінку з посилання (AC-DSYS-08). Next.js і Supabase замінено моками:
// redirect кидає виняток, як у Next.js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ signInError: null as { message: string } | null, role: "manager" }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: state.signInError }),
      getClaims: async () => ({ data: { claims: { sub: "user-1" } } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: state.role } }) }) }) }),
  }),
}));

const { login } = await import("./actions");

const RUN = "/runs/10000000-0000-4000-8000-0000000000a1";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const redirectOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

beforeEach(() => {
  state.signInError = null;
  state.role = "manager";
});

describe("Дія входу", () => {
  it("AC-DSYS-08: менеджер B входить зі сторінки входу, відкритої за посиланням на запуск, — бачить сторінку запуску", async () => {
    const credentials = { email: "manager.b@example.test", password: "synthetic" };
    expect(await redirectOf(login(form({ ...credentials, next: RUN })))).toBe(`REDIRECT:${RUN}`);
    // Без посилання — як раніше, на головну; чужа адреса — теж на головну.
    expect(await redirectOf(login(form(credentials)))).toBe("REDIRECT:/");
    expect(await redirectOf(login(form({ ...credentials, next: "//evil.example" })))).toBe("REDIRECT:/");
  });

  it("AC-VENDOR-03: вендор після входу без посилання одразу бачить список своїх запусків; з посиланням — сторінку з посилання", async () => {
    // Робоче рішення до solomchaak/property-workflows-spec#44 (основний сценарій вимоги, крок 3).
    state.role = "vendor";
    const credentials = { email: "vendor@example.test", password: "synthetic" };
    expect(await redirectOf(login(form(credentials)))).toBe("REDIRECT:/runs");
    expect(await redirectOf(login(form({ ...credentials, next: RUN })))).toBe(`REDIRECT:${RUN}`);
  });

  it("AC-VENDOR-13: вендор V входить — потрапляє на список запусків", async () => {
    // Рішення PM solomchaak/property-workflows-spec#44: після входу вендор бачить список запусків.
    state.role = "vendor";
    expect(await redirectOf(login(form({ email: "vendor@example.test", password: "synthetic" })))).toBe("REDIRECT:/runs");
  });

  it("AC-DSYS-08: невдалий вхід лишає повернення на запуск для наступної спроби", async () => {
    state.signInError = { message: "Invalid login credentials" };
    expect(await redirectOf(login(form({ email: "manager.b@example.test", password: "wrong", next: RUN })))).toBe(
      `REDIRECT:/login?error=invalid&next=${encodeURIComponent(RUN)}`,
    );
  });
});
