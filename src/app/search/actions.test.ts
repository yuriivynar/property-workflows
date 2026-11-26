// Палітра ⌘K (рішення власника 2026-11-26, ADR 0012): лише те, що користувач і так бачить; вендору — без шаблонів.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  claims: { sub: "u1" } as { sub: string } | null,
  role: "vendor",
  rpc: vi.fn(async () => ({ data: [{ id: "r1", case_name: "Apartment 12, move-in", my_done: 1, my_total: 2 }] })),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: state.claims } }) },
    from: (table: string) => {
      state.from(table);
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: state.role } }) }) }) };
      if (table === "run_overview")
        return { select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "r2", case_name: "Apartment 7, leak", done_count: 0, total_count: 3 }] }) }) }) };
      return { select: () => ({ order: async () => ({ data: [{ id: "t1", name: "Repair" }] }) }) };
    },
    rpc: state.rpc,
  }),
}));

const { searchIndex } = await import("./actions");

describe("searchIndex", () => {
  beforeEach(() => {
    state.claims = { sub: "u1" };
    state.from.mockClear();
  });

  it("не увійшов — порожньо", async () => {
    state.claims = null;
    expect(await searchIndex()).toEqual([]);
  });

  it("вендор — лише свої запуски й профіль, шаблонів не запитуємо", async () => {
    state.role = "vendor";
    const items = await searchIndex();
    expect(items.map((item) => item.label)).toEqual(["Apartment 12, move-in", "Open your profile"]);
    expect(items[0].hint).toBe("Your tasks: 1 of 2 done");
    expect(state.from).not.toHaveBeenCalledWith("templates");
  });

  it("менеджер — запуски з прогресом, шаблони й дії", async () => {
    state.role = "manager";
    const items = await searchIndex();
    expect(items.map((item) => `${item.group}:${item.label}:${item.hint}`)).toEqual([
      "Runs:Apartment 7, leak:0 of 3 done",
      "Templates:Repair:Template",
      "Actions:Launch a template:Action",
      "Actions:Open your profile:Action",
    ]);
  });
});
