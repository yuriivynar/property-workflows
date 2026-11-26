// Сторінка /login для того, хто вже увійшов: не форма входу в макеті з навігацією, а перехід туди, куди вело
// посилання (AC-DSYS-08), чи на свою першу сторінку (вендор — список запусків, AC-VENDOR-13). Next.js і Supabase —
// моки: redirect кидає виняток, як у Next.js.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: null as string | null, role: "manager" }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: state.userId ? { claims: { sub: state.userId } } : null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: state.role } }) }) }) }),
  }),
}));
vi.mock("./actions", () => ({ login: vi.fn() }));

const { default: LoginPage } = await import("./page");

const RUN = "/runs/10000000-0000-4000-8000-0000000000a1";
const open = (params: Record<string, string> = {}) =>
  LoginPage({ params: Promise.resolve({}), searchParams: Promise.resolve(params) } as Parameters<typeof LoginPage>[0]).then(
    () => "FORM",
    (e: Error) => e.message,
  );

beforeEach(() => {
  state.userId = null;
  state.role = "manager";
});

describe("Сторінка входу для того, хто вже увійшов", () => {
  it("AC-DSYS-08: увійдений менеджер відкриває /login з посиланням на запуск — потрапляє на запуск, а не на форму", async () => {
    state.userId = "user-1";
    expect(await open({ next: RUN })).toBe(`REDIRECT:${RUN}`);
    expect(await open()).toBe("REDIRECT:/");
    expect(await open({ next: "//evil.example" })).toBe("REDIRECT:/");
  });

  it("AC-VENDOR-13: увійдений вендор відкриває /login — потрапляє на список запусків", async () => {
    state.userId = "vendor-1";
    state.role = "vendor";
    expect(await open()).toBe("REDIRECT:/runs");
  });

  it("AC-DSYS-03: відвідувач без входу бачить форму входу", async () => {
    expect(await open({ next: RUN })).toBe("FORM");
  });
});
