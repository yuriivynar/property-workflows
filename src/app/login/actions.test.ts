// Дія входу: після входу — на сторінку з посилання (AC-DSYS-08). Next.js і Supabase замінено моками:
// redirect кидає виняток, як у Next.js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ signInError: null as { message: string } | null }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: state.signInError }) },
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
});

describe("Дія входу", () => {
  it("AC-DSYS-08: менеджер B входить зі сторінки входу, відкритої за посиланням на запуск, — бачить сторінку запуску", async () => {
    const credentials = { email: "manager.b@example.test", password: "synthetic" };
    expect(await redirectOf(login(form({ ...credentials, next: RUN })))).toBe(`REDIRECT:${RUN}`);
    // Без посилання — як раніше, на головну; чужа адреса — теж на головну.
    expect(await redirectOf(login(form(credentials)))).toBe("REDIRECT:/");
    expect(await redirectOf(login(form({ ...credentials, next: "//evil.example" })))).toBe("REDIRECT:/");
  });

  it("AC-DSYS-08: невдалий вхід лишає повернення на запуск для наступної спроби", async () => {
    state.signInError = { message: "Invalid login credentials" };
    expect(await redirectOf(login(form({ email: "manager.b@example.test", password: "wrong", next: RUN })))).toBe(
      `REDIRECT:/login?error=invalid&next=${encodeURIComponent(RUN)}`,
    );
  });
});
