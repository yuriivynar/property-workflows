// Дії редактора: перевірка ролі ДО запису (AC-EDITOR-08 на рівні дії). Next.js і Supabase замінено моками:
// redirect кидає виняток, як у Next.js, а клієнт Supabase записує кожен запис у state.writes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEMPLATE = "10000000-0000-4000-8000-000000000001";
const SECTION = "10000000-0000-4000-8000-000000000011";

const state = vi.hoisted(() => ({
  claims: { sub: "user-1" } as { sub: string } | null,
  role: "manager" as string | null,
  writes: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: state.claims ? { claims: state.claims } : null }) },
    from: (table: string) => {
      const write = (op: string) => {
        state.writes.push(`${op}:${table}`);
        return chain;
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        in: () => chain,
        single: async () => ({ data: { id: TEMPLATE }, error: null }),
        maybeSingle: async () => ({ data: table === "profiles" ? { role: state.role } : null, error: null }),
        insert: () => write("insert"),
        update: () => write("update"),
        delete: () => write("delete"),
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      };
      return chain;
    },
    rpc: async (fn: string) => {
      state.writes.push(`rpc:${fn}`);
      return { data: 2, error: null };
    },
  }),
}));

const actions = await import("./actions");

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
  state.claims = { sub: "user-1" };
  state.role = "manager";
  state.writes = [];
});

describe("Дії редактора шаблону", () => {
  it("AC-EDITOR-08: менеджер викликає дії напряму — «Not enough rights», жодного запису", async () => {
    const calls: Promise<unknown>[] = [
      actions.createTemplate(form({ name: "Hacked" })),
      actions.addTask(form({ template_id: TEMPLATE, section_id: SECTION, name: "Hacked" })),
      actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION })),
      actions.moveItem(form({ template_id: TEMPLATE, item_id: SECTION, kind: "section", direction: "up" })),
      actions.saveVersion(form({ template_id: TEMPLATE })),
    ];
    for (const call of calls) expect(await redirectOf(call)).toMatch(/error=NOT_ALLOWED/);
    expect(state.writes).toEqual([]);
  });

  it("AC-EDITOR-09: без входу дія не пише нічого й веде на сторінку входу", async () => {
    state.claims = null;
    expect(await redirectOf(actions.saveVersion(form({ template_id: TEMPLATE })))).toBe("REDIRECT:/login");
    expect(await redirectOf(actions.addSection(form({ template_id: TEMPLATE, name: "X" })))).toBe("REDIRECT:/login");
    expect(state.writes).toEqual([]);
  });

  it("AC-EDITOR-03: адміністратор зберігає версію — виклик save_template_version і «Version 2 saved»", async () => {
    state.role = "admin";
    expect(await redirectOf(actions.saveVersion(form({ template_id: TEMPLATE })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit?saved=2`,
    );
    expect(state.writes).toEqual(["rpc:save_template_version"]);
  });
});
