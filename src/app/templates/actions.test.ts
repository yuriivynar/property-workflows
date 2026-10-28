// Дії редактора: перевірка ролі ДО запису (AC-EDITOR-08 на рівні дії). Next.js і Supabase замінено моками:
// redirect кидає виняток, як у Next.js, а клієнт Supabase записує кожен запис у state.writes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEMPLATE = "10000000-0000-4000-8000-000000000001";
const SECTION = "10000000-0000-4000-8000-000000000011";

const state = vi.hoisted(() => ({
  claims: { sub: "user-1" } as { sub: string } | null,
  role: "manager" as string | null,
  writes: [] as string[],
  // Рядки, які повертає update(…).select(…): порожньо — рядка ще немає (дія вставить його).
  updatedRows: [] as unknown[],
  // Аргументи запису й фільтри — щоб перевірити, що саме й куди пише дія.
  payloads: [] as unknown[],
  filters: [] as [string, unknown][],
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
      let lastOp = "";
      const write = (op: string) => {
        lastOp = op;
        state.writes.push(`${op}:${table}`);
        return chain;
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          state.filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        in: () => chain,
        single: async () => ({ data: { id: TEMPLATE }, error: null }),
        maybeSingle: async () => ({ data: table === "profiles" ? { role: state.role } : null, error: null }),
        insert: (values: unknown) => {
          state.payloads.push(values);
          return write("insert");
        },
        update: (values: unknown) => {
          state.payloads.push(values);
          return write("update");
        },
        delete: () => write("delete"),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: lastOp === "update" ? state.updatedRows : null, error: null }),
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
  state.updatedRows = [];
  state.payloads = [];
  state.filters = [];
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

  it("AC-EDITOR-19: адміністратор створює шаблон з порожньою назвою чи лише з пробілів — без запису, «Enter a template name»", async () => {
    state.role = "admin";
    for (const name of ["", "   "]) {
      expect(await redirectOf(actions.createTemplate(form({ name })))).toBe(
        "REDIRECT:/templates?error=TEMPLATE_NAME_REQUIRED",
      );
    }
    expect(state.writes).toEqual([]);
  });

  it("AC-EDITOR-26: відвідувач без входу змінює шаблон чи зберігає версію напряму — на сторінку входу, без запису", async () => {
    state.claims = null;
    const calls: Promise<unknown>[] = [
      actions.createTemplate(form({ name: "Tenant move-in" })),
      actions.addTask(form({ template_id: TEMPLATE, section_id: SECTION, name: "Sign handover act" })),
      actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION })),
      actions.saveVersion(form({ template_id: TEMPLATE })),
    ];
    for (const call of calls) expect(await redirectOf(call)).toBe("REDIRECT:/login");
    expect(state.writes).toEqual([]);
  });

  it("AC-EDITOR-21: перейменування пише лише робочу назву (template_draft_names), не назву поточної версії", async () => {
    state.role = "admin";
    expect(await redirectOf(actions.renameTemplate(form({ template_id: TEMPLATE, name: "Tenant move-in (2026)" })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    // Робочої назви ще немає: update не змінив жодного рядка, тож дія вставляє її. templates не чіпаємо.
    expect(state.writes).toEqual(["update:template_draft_names", "insert:template_draft_names"]);
    expect(state.payloads).toEqual([
      { name: "Tenant move-in (2026)" },
      { template_id: TEMPLATE, name: "Tenant move-in (2026)" },
    ]);
    expect(state.filters).toContainEqual(["template_id", TEMPLATE]);

    state.writes = [];
    expect(await redirectOf(actions.renameTemplate(form({ template_id: TEMPLATE, name: "  " })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit?error=TEMPLATE_NAME_REQUIRED`,
    );
    state.role = "manager";
    expect(await redirectOf(actions.renameTemplate(form({ template_id: TEMPLATE, name: "Hacked" })))).toMatch(
      /error=NOT_ALLOWED/,
    );
    expect(state.writes).toEqual([]);
  });

  it("AC-EDITOR-20: адміністратор очищує назву задачі чи розділу — зміна записується в незбережені зміни, без відмови", async () => {
    state.role = "admin";
    expect(await redirectOf(actions.renameTask(form({ template_id: TEMPLATE, task_id: SECTION, name: "  " })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    expect(await redirectOf(actions.renameSection(form({ template_id: TEMPLATE, section_id: SECTION, name: " 	 " })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    expect(state.writes).toEqual(["update:template_tasks", "update:template_sections"]);
    // Очищена назва записується саме порожнім рядком, а не пробілами.
    expect(state.payloads).toEqual([{ name: "" }, { name: "" }]);
  });

  it("AC-EDITOR-13: видалення розділу без підтвердження (скасування чи прямий запит) нічого не видаляє", async () => {
    state.role = "admin";
    expect(await redirectOf(actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    expect(state.writes).toEqual([]);
    await redirectOf(actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION, confirmed: "true" })));
    expect(state.writes).toEqual(["delete:template_sections"]);
  });

  it("AC-EDITOR-21: повторне перейменування оновлює наявну робочу назву — лише update, без insert", async () => {
    state.role = "admin";
    state.updatedRows = [{ template_id: TEMPLATE }];
    expect(await redirectOf(actions.renameTemplate(form({ template_id: TEMPLATE, name: "Tenant move-in (2027)" })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    expect(state.writes).toEqual(["update:template_draft_names"]);
    expect(state.payloads).toEqual([{ name: "Tenant move-in (2027)" }]);
    expect(state.filters).toContainEqual(["template_id", TEMPLATE]);
  });
});
