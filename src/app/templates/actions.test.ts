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
  // Аргументи rpc(...) і параметри upsert(..., options): що саме дія просить у бази.
  rpcArgs: [] as unknown[],
  upsertOptions: [] as unknown[],
  // Помилка single() після insert (наприклад, назва зайнята — AC-EDITOR-23).
  singleError: null as { message: string; code?: string } | null,
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
        single: async () => (state.singleError ? { data: null, error: state.singleError } : { data: { id: TEMPLATE }, error: null }),
        maybeSingle: async () => ({ data: table === "profiles" ? { role: state.role } : null, error: null }),
        insert: (values: unknown) => {
          state.payloads.push(values);
          return write("insert");
        },
        update: (values: unknown) => {
          state.payloads.push(values);
          return write("update");
        },
        upsert: (values: unknown, options: unknown) => {
          state.payloads.push(values);
          state.upsertOptions.push(options);
          return write("upsert");
        },
        delete: () => write("delete"),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: lastOp === "update" || lastOp === "delete" ? state.updatedRows : null, error: null }),
      };
      return chain;
    },
    rpc: async (fn: string, args: unknown) => {
      state.writes.push(`rpc:${fn}`);
      state.rpcArgs.push(args);
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
  state.rpcArgs = [];
  state.upsertOptions = [];
  state.singleError = null;
});

describe("Дії редактора шаблону", () => {
  it("AC-EDITOR-08: менеджер викликає дії напряму — «Not enough rights», жодного запису", async () => {
    const calls: Promise<unknown>[] = [
      actions.createTemplate(form({ name: "Hacked" })),
      actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION })),
      actions.moveItem(form({ template_id: TEMPLATE, item_id: SECTION, kind: "section", direction: "up" })),
      actions.saveVersion(form({ template_id: TEMPLATE })),
    ];
    for (const call of calls) expect(await redirectOf(call)).toMatch(/error=NOT_ALLOWED/);
    // Форма «New task» викликає дію, що повертає результат значенням (AC-EDITOR-25).
    expect(await actions.addTaskInline(form({ template_id: TEMPLATE, section_id: SECTION, name: "Hacked" }))).toEqual({
      ok: false,
      code: "NOT_ALLOWED",
    });
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
    // Один upsert за template_id (без «update, а потім insert» — гонка при подвійному кліку). templates не чіпаємо.
    expect(state.writes).toEqual(["upsert:template_draft_names"]);
    expect(state.payloads).toEqual([{ template_id: TEMPLATE, name: "Tenant move-in (2026)" }]);
    expect(state.upsertOptions).toEqual([{ onConflict: "template_id" }]);

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
    state.updatedRows = [{ id: SECTION }];
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
    state.updatedRows = [{ id: SECTION }];
    await redirectOf(actions.removeSection(form({ template_id: TEMPLATE, section_id: SECTION, confirmed: "true" })));
    expect(state.writes).toEqual(["delete:template_sections"]);
    expect(state.filters).toContainEqual(["id", SECTION]);
  });

  it("AC-EDITOR-28: перенесення задачі — функцією бази; менеджер — «Not enough rights» без запису", async () => {
    const move = () => actions.moveTaskToSection(form({ template_id: TEMPLATE, task_id: SECTION, section_id: SECTION }));
    expect(await redirectOf(move())).toMatch(/error=NOT_ALLOWED/);
    expect(state.writes).toEqual([]);
    state.role = "admin";
    expect(await redirectOf(move())).toBe(`REDIRECT:/templates/${TEMPLATE}/edit`);
    expect(state.writes).toEqual(["rpc:move_template_task_to_section"]);
  });

  it("AC-EDITOR-25: дія для форми «New task» повертає результат значенням — успіх, відмову ролі чи порожню назву, без redirect", async () => {
    const add = (name: string) => actions.addTaskInline(form({ template_id: TEMPLATE, section_id: SECTION, name }));
    expect(await add("Sign handover act")).toEqual({ ok: false, code: "NOT_ALLOWED" });
    expect(state.writes).toEqual([]);
    state.role = "admin";
    expect(await add("  ")).toEqual({ ok: false, code: "NAME_REQUIRED" });
    expect(state.writes).toEqual([]);
    expect(await add("Sign handover act")).toEqual({ ok: true });
    // Позицію рахує база в тій самій транзакції (rpc), а не дія двома запитами.
    expect(state.writes).toEqual(["rpc:add_template_task"]);
    expect(state.rpcArgs).toEqual([
      { p_template_id: TEMPLATE, p_section_id: SECTION, p_name: "Sign handover act", p_is_required: false },
    ]);
  });

  it("AC-EDITOR-01: розділ додається функцією бази; менеджер — без запису, порожня назва — без запису", async () => {
    expect(await redirectOf(actions.addSection(form({ template_id: TEMPLATE, name: "Keys" })))).toMatch(/error=NOT_ALLOWED/);
    expect(state.writes).toEqual([]);
    state.role = "admin";
    expect(await redirectOf(actions.addSection(form({ template_id: TEMPLATE, name: "  " })))).toMatch(/error=NAME_REQUIRED/);
    expect(state.writes).toEqual([]);
    expect(await redirectOf(actions.addSection(form({ template_id: TEMPLATE, name: "Keys" })))).toBe(
      `REDIRECT:/templates/${TEMPLATE}/edit`,
    );
    expect(state.writes).toEqual(["rpc:add_template_section"]);
    expect(state.rpcArgs).toEqual([{ p_template_id: TEMPLATE, p_name: "Keys" }]);
  });

  it("AC-EDITOR-21: повторне перейменування — той самий один upsert, а не окремі update чи insert", async () => {
    state.role = "admin";
    for (const name of ["Tenant move-in (2027)", "Tenant move-in (2028)"]) {
      expect(await redirectOf(actions.renameTemplate(form({ template_id: TEMPLATE, name })))).toBe(
        `REDIRECT:/templates/${TEMPLATE}/edit`,
      );
    }
    expect(state.writes).toEqual(["upsert:template_draft_names", "upsert:template_draft_names"]);
    expect(state.payloads).toEqual([
      { template_id: TEMPLATE, name: "Tenant move-in (2027)" },
      { template_id: TEMPLATE, name: "Tenant move-in (2028)" },
    ]);
  });

  // Рев'ю WS7 №2: дія пише лише в елемент цього шаблону й помічає, що нічого не змінилося (стара вкладка, чужий id).
  it.each([
    ["renameSection", "update:template_sections", { section_id: SECTION, name: "Keys" }],
    ["removeSection", "delete:template_sections", { section_id: SECTION, confirmed: "true" }],
    ["renameTask", "update:template_tasks", { task_id: SECTION, name: "Sign handover act" }],
    ["setTaskRequired", "update:template_tasks", { task_id: SECTION, is_required: "true" }],
    ["removeTask", "delete:template_tasks", { task_id: SECTION }],
  ] as const)(
    "AC-EDITOR-25: %s без зміненого рядка (елемента вже немає або він з іншого шаблону) — «Your last change was not kept. Try again.»",
    async (name, write, fields) => {
      state.role = "admin";
      const action = actions[name] as (form: FormData) => Promise<unknown>;
      state.updatedRows = [];
      expect(await redirectOf(action(form({ template_id: TEMPLATE, ...fields })))).toBe(
        `REDIRECT:/templates/${TEMPLATE}/edit?error=CHANGE_NOT_KEPT`,
      );
      expect(state.writes).toEqual([write]);
      expect(state.filters).toContainEqual(["template_id", TEMPLATE]);
      // Запис обмежено саме цим елементом: фільтр за його id теж є (рев'ю CodeRabbit, PR #79).
      expect(state.filters).toContainEqual(["id", "section_id" in fields ? fields.section_id : fields.task_id]);
      const { messageForTemplateError } = await import("@/lib/templates/domain");
      expect(messageForTemplateError("CHANGE_NOT_KEPT")).toBe("Your last change was not kept. Try again.");

      state.writes = [];
      state.updatedRows = [{ id: SECTION }];
      expect(await redirectOf(action(form({ template_id: TEMPLATE, ...fields })))).toBe(`REDIRECT:/templates/${TEMPLATE}/edit`);
      expect(state.writes).toEqual([write]);
    },
  );
});


describe("Створення шаблону: введена назва лишається", () => {
  it("AC-EDITOR-23: назва зайнята — помилка під полем і введена назва повертається у вікно (?name=…)", async () => {
    state.role = "admin";
    state.singleError = { message: "NAME_TAKEN", code: "P0001" };

    expect(await redirectOf(actions.createTemplate(form({ name: " tenant MOVE-IN " })))).toBe(
      "REDIRECT:/templates?error=NAME_TAKEN&name=tenant%20MOVE-IN",
    );
  });
});
