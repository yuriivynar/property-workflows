// Додавання розділу й задачі та перейменування шаблону — одна транзакція в базі (рев'ю безпеки 2026-11-17, знахідка 7):
// add_template_section, add_template_task і upsert робочої назви (supabase/migrations/20261117094426_template_editor_atomic_adds.sql).
// Межа емуляції: PGlite — одне з'єднання, справжніх паралельних транзакцій тут немає, тож гонку «прочитав max → інший
// вставив → я вставив» відтворюємо за кроками: стара схема на застарілій позиції впирається в унікальність, функція — ні.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER: string;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER = t.users["manager.a@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

const message = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

async function newTemplate(name: string) {
  const [{ id }] = await t.asUser<{ id: string }>(ADMIN, "insert into public.templates (name) values ($1) returning id", [name]);
  return id;
}
const addSection = (template: string, name: string, user = ADMIN) =>
  t.asUser<{ id: string }>(user, "select public.add_template_section($1, $2) as id", [template, name]).then((r) => r[0].id);
const addTask = (template: string, section: string, name: string, required = false, user = ADMIN) =>
  t
    .asUser<{ id: string }>(user, "select public.add_template_task($1, $2, $3, $4) as id", [template, section, name, required])
    .then((r) => r[0].id);
const positions = async (table: "template_sections" | "template_tasks", column: string, parent: string) =>
  (await t.asService<{ position: number }>(`select position from public.${table} where ${column} = $1 order by position`, [parent])).map(
    (r) => r.position,
  );

describe("add_template_section: позицію рахує база в тій самій транзакції", () => {
  it("AC-EDITOR-01: розділи отримують позиції 1, 2, 3, а позначка «Unpublished changes» ставиться", async () => {
    const template = await newTemplate("Atomic sections");
    for (const name of ["First", "Second", "Third"]) await addSection(template, name);
    expect(await positions("template_sections", "template_id", template)).toEqual([1, 2, 3]);
    const [row] = await t.asService<{ has_unpublished_changes: boolean }>(
      "select has_unpublished_changes from public.templates where id = $1",
      [template],
    );
    expect(row.has_unpublished_changes).toBe(true);
  });

  it("AC-EDITOR-01: після видалення розділу з середини наступний — max + 1, а не кількість + 1", async () => {
    const template = await newTemplate("Atomic sections gap");
    const [, second] = [await addSection(template, "A"), await addSection(template, "B"), await addSection(template, "C")];
    await t.asService("delete from public.template_sections where id = $1", [second]);
    await addSection(template, "D");
    expect(await positions("template_sections", "template_id", template)).toEqual([1, 3, 4]);
  });

  it("AC-EDITOR-01: два додавання в одній транзакції (подвійний клік) не дають однакових позицій", async () => {
    const template = await newTemplate("Atomic sections double");
    const [row] = await t.asUser<{ a: string; b: string }>(
      ADMIN,
      "select public.add_template_section($1, 'Left') as a, public.add_template_section($1, 'Right') as b",
      [template],
    );
    expect(row.a).not.toBe(row.b);
    expect(await positions("template_sections", "template_id", template)).toEqual([1, 2]);
  });

  it("AC-EDITOR-01: стара схема «прочитав max, потім вставив» на застарілій позиції впирається в унікальність, функція — ні", async () => {
    const template = await newTemplate("Atomic sections race");
    await addSection(template, "Existing");
    // Крок 1 «вкладки A»: прочитала max(position) = 1 і збирається вставити позицію 2.
    const [{ max }] = await t.asService<{ max: number }>("select max(position) as max from public.template_sections where template_id = $1", [
      template,
    ]);
    // Крок 2 «вкладки B»: встигла додати розділ раніше.
    await addSection(template, "From the other tab");
    // Крок 3 «вкладки A»: вставка зі застарілою позицією.
    const stale = await message(
      t.asUser(ADMIN, "insert into public.template_sections (template_id, name, position) values ($1, 'Stale', $2)", [template, max + 1]),
    );
    expect(stale).toMatch(/template_sections_position_key/);
    // Те саме через функцію: позицію бере база, помилки немає.
    await addSection(template, "Via function");
    expect(await positions("template_sections", "template_id", template)).toEqual([1, 2, 3]);
  });

  it("AC-EDITOR-08: менеджер не додає розділ прямим викликом, відвідувач без входу — теж", async () => {
    const template = await newTemplate("Atomic sections rights");
    expect(await message(addSection(template, "Hacked", MANAGER))).toMatch(/NOT_ALLOWED/);
    expect(await message(t.asAnon("select public.add_template_section($1, 'X')", [template]))).toMatch(/permission denied/);
    expect(await message(t.asAnon("select private.add_template_section($1, 'X')", [template]))).toMatch(/permission denied/);
    expect(await positions("template_sections", "template_id", template)).toEqual([]);
  });

  it("AC-EDITOR-08: шаблону, якого немає, — TEMPLATE_NOT_FOUND", async () => {
    const missing = "10000000-0000-4000-8000-0000000000ff";
    expect(await message(addSection(missing, "X"))).toMatch(/TEMPLATE_NOT_FOUND/);
  });
});

describe("add_template_task: позицію в розділі рахує база", () => {
  it("AC-EDITOR-01: задачі отримують позиції 1, 2, 3 у своєму розділі, обов'язковість зберігається", async () => {
    const template = await newTemplate("Atomic tasks");
    const section = await addSection(template, "Day one");
    const other = await addSection(template, "Day two");
    await addTask(template, section, "Keys", true);
    await addTask(template, section, "Meter reading");
    await addTask(template, other, "Welcome pack");
    await addTask(template, section, "Walkthrough");
    expect(await positions("template_tasks", "section_id", section)).toEqual([1, 2, 3]);
    expect(await positions("template_tasks", "section_id", other)).toEqual([1]);
    const rows = await t.asService<{ name: string; is_required: boolean }>(
      "select name, is_required from public.template_tasks where section_id = $1 order by position",
      [section],
    );
    expect(rows.map((r) => [r.name, r.is_required])).toEqual([
      ["Keys", true],
      ["Meter reading", false],
      ["Walkthrough", false],
    ]);
  });

  it("AC-EDITOR-01: два додавання в одній транзакції (подвійний клік) не дають однакових позицій", async () => {
    const template = await newTemplate("Atomic tasks double");
    const section = await addSection(template, "Day one");
    const [row] = await t.asUser<{ a: string; b: string }>(
      ADMIN,
      "select public.add_template_task($1, $2, 'Left', false) as a, public.add_template_task($1, $2, 'Right', true) as b",
      [template, section],
    );
    expect(row.a).not.toBe(row.b);
    expect(await positions("template_tasks", "section_id", section)).toEqual([1, 2]);
  });

  it("AC-EDITOR-08: менеджер не додає задачу прямим викликом", async () => {
    const template = await newTemplate("Atomic tasks rights");
    const section = await addSection(template, "Day one");
    expect(await message(addTask(template, section, "Hacked", false, MANAGER))).toMatch(/NOT_ALLOWED/);
    expect(await message(t.asAnon("select public.add_template_task($1, $2, 'X', false)", [template, section]))).toMatch(/permission denied/);
    expect(await positions("template_tasks", "section_id", section)).toEqual([]);
  });

  it("AC-EDITOR-08: розділ іншого шаблону чи відсутній — TEMPLATE_ITEM_NOT_FOUND, нічого не записано", async () => {
    const mine = await newTemplate("Atomic tasks mine");
    const theirs = await newTemplate("Atomic tasks theirs");
    const foreignSection = await addSection(theirs, "Foreign");
    expect(await message(addTask(mine, foreignSection, "Smuggled"))).toMatch(/TEMPLATE_ITEM_NOT_FOUND/);
    expect(await message(addTask(mine, "10000000-0000-4000-8000-0000000000ff", "Ghost"))).toMatch(/TEMPLATE_ITEM_NOT_FOUND/);
    expect(await positions("template_tasks", "section_id", foreignSection)).toEqual([]);
  });
});

describe("Робоча назва шаблону: upsert, який генерує PostgREST", () => {
  // supabase.from("template_draft_names").upsert({ template_id, name }, { onConflict: "template_id" }) → цей SQL:
  const UPSERT = `insert into public.template_draft_names (template_id, name) values ($1, $2)
    on conflict (template_id) do update set template_id = excluded.template_id, name = excluded.name`;
  const draftNames = (template: string) =>
    t.asService<{ name: string }>("select name from public.template_draft_names where template_id = $1", [template]);

  it("AC-EDITOR-21: перше перейменування вставляє робочу назву, повторні — оновлюють той самий рядок", async () => {
    const template = await newTemplate("Atomic rename");
    await t.asUser(ADMIN, UPSERT, [template, "Atomic rename (2026)"]);
    await t.asUser(ADMIN, UPSERT, [template, "Atomic rename (2027)"]);
    await t.asUser(ADMIN, UPSERT, [template, "Atomic rename (2028)"]);
    expect(await draftNames(template)).toEqual([{ name: "Atomic rename (2028)" }]);
    // Назва поточної версії не змінюється (AC-EDITOR-21).
    const [row] = await t.asService<{ name: string }>("select name from public.templates where id = $1", [template]);
    expect(row.name).toBe("Atomic rename");
  });

  it("AC-EDITOR-08: менеджер не перейменовує шаблон через upsert", async () => {
    const template = await newTemplate("Atomic rename rights");
    expect(await message(t.asUser(MANAGER, UPSERT, [template, "Hacked"]))).toMatch(/row-level security|permission denied/);
    expect(await draftNames(template)).toEqual([]);
  });
});
