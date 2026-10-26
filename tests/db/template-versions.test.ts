// Версії шаблонів — правила, які виконує база (RLS, колонкові GRANT, save_template_version, move_template_item,
// launch_run з поточної версії), на справжньому Postgres (PGlite) з усіма міграціями.
// Покриває AC-EDITOR-* у docs/conformance.md (специфікація openspec/specs/template-versions).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string;

/** Шаблон як «Tenant move-in» з AC: 2 розділи, 5 задач (3 обов'язкові), збережений як версія 1. */
async function tenantMoveIn(prefix: string) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const before = `${prefix}-0000-4000-8000-000000000011`;
  const moveIn = `${prefix}-0000-4000-8000-000000000012`;
  await t.asService("insert into public.templates (id, name) values ($1, $2)", [template, `Tenant move-in ${prefix}`]);
  await t.asService(
    "insert into public.template_sections (id, template_id, name, position) values ($1, $3, 'Before move-in', 1), ($2, $3, 'Move-in day', 2)",
    [before, moveIn, template],
  );
  await t.asService(
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
       ($1, $2, 'Sign the lease', true, 1), ($1, $2, 'Collect the deposit', true, 2),
       ($1, $3, 'Hand over the keys', true, 1), ($1, $3, 'Record meter readings', false, 2), ($1, $3, 'Order cleaning', false, 3)`,
    [template, before, moveIn],
  );
  await t.saveVersion(template);
  return { template, before, moveIn };
}

/** Як дія редактора addTask: адміністратор додає шосту задачу «Sign handover act» до «Move-in day». */
const addSixthTask = (userId: string, template: string, moveIn: string) =>
  t.asUser(
    userId,
    `insert into public.template_tasks (template_id, section_id, name, is_required, position)
     values ($1, $2, 'Sign handover act', false, 4)`,
    [template, moveIn],
  );

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

/** Стан шаблону в обхід RLS — для перевірки «що не змінилося». */
async function stateOf(template: string) {
  const [row] = await t.asService<{
    current_version: number | null;
    has_unpublished_changes: boolean;
    versions: number;
    tasks: number;
    sections: number;
  }>(
    `select t.current_version, t.has_unpublished_changes,
            (select count(*)::int from public.template_versions where template_id = t.id) as versions,
            (select count(*)::int from public.template_tasks where template_id = t.id) as tasks,
            (select count(*)::int from public.template_sections where template_id = t.id) as sections
     from public.templates as t where t.id = $1`,
    [template],
  );
  return row;
}

/** Кількість задач у знімку версії. */
const tasksInVersion = async (template: string, number: number) =>
  (
    await t.asService<{ n: number }>(
      `select count(*)::int as n from public.template_versions as v,
         jsonb_array_elements(v.content -> 'sections') as s, jsonb_array_elements(s -> 'tasks')
       where v.template_id = $1 and v.number = $2`,
      [template, number],
    )
  )[0].n;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: версії шаблону", () => {
  it("AC-EDITOR-02: менеджер бачить версію 1 з 5 задачами — без незбережених змін і без робочої копії", async () => {
    const { template, moveIn } = await tenantMoveIn("e0200000");
    await addSixthTask(ADMIN, template, moveIn);
    expect((await stateOf(template)).has_unpublished_changes).toBe(true);

    // Робочої копії (незбережених змін) менеджер не бачить зовсім.
    const draft = await t.asUser(MANAGER_B, "select id from public.template_tasks where template_id = $1", [template]);
    expect(draft).toHaveLength(0);
    const sections = await t.asUser(MANAGER_B, "select id from public.template_sections where template_id = $1", [
      template,
    ]);
    expect(sections).toHaveLength(0);

    // Бачить лише поточну версію 1 — з 5 задачами.
    const versions = await t.asUser<{ number: number; tasks: number }>(
      MANAGER_B,
      `select v.number, (select count(*)::int from jsonb_array_elements(v.content -> 'sections') as s,
                           jsonb_array_elements(s -> 'tasks')) as tasks
       from public.template_versions as v where v.template_id = $1`,
      [template],
    );
    expect(versions).toEqual([{ number: 1, tasks: 5 }]);
  });

  it("AC-EDITOR-02: незбережений шаблон менеджер не бачить зовсім", async () => {
    // Як дія createTemplate: адміністратор задає лише назву (колонковий GRANT), id генерує база.
    const [{ id: template }] = await t.asUser<{ id: string }>(
      ADMIN,
      "insert into public.templates (name) values ('Never saved') returning id",
    );
    const rows = await t.asUser(MANAGER_A, "select id from public.templates where id = $1", [template]);
    expect(rows).toHaveLength(0);
    const adminRows = await t.asUser(ADMIN, "select id from public.templates where id = $1", [template]);
    expect(adminRows).toHaveLength(1);
  });

  it("AC-EDITOR-03: збереження незбережених змін (6 задач) від версії 1 створює поточну версію 2 і знімає позначку", async () => {
    const { template, moveIn } = await tenantMoveIn("e0300000");
    await addSixthTask(ADMIN, template, moveIn);

    const [{ number }] = await t.asUser<{ number: number }>(
      ADMIN,
      "select public.save_template_version($1) as number",
      [template],
    );

    expect(number).toBe(2);
    const state = await stateOf(template);
    expect(state.current_version).toBe(2);
    expect(state.has_unpublished_changes).toBe(false);
    expect(await tasksInVersion(template, 2)).toBe(6);
    expect(await tasksInVersion(template, 1)).toBe(5); // збережена версія не змінюється
  });

  it("AC-EDITOR-04: новий шаблон «Repair» без обов'язкових задач не зберігається — версії немає, 1 розділ і 3 задачі лишаються", async () => {
    // Як дії редактора: адміністратор створює шаблон, розділ і 3 необов'язкові задачі (id генерує база).
    const [{ id: template }] = await t.asUser<{ id: string }>(
      ADMIN,
      "insert into public.templates (name) values ('Repair') returning id",
    );
    const [{ id: section }] = await t.asUser<{ id: string }>(
      ADMIN,
      "insert into public.template_sections (template_id, name, position) values ($1, 'Work', 1) returning id",
      [template],
    );
    await t.asUser(
      ADMIN,
      `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
         ($1, $2, 'Inspect', false, 1), ($1, $2, 'Repair', false, 2), ($1, $2, 'Clean up', false, 3)`,
      [template, section],
    );

    const error = await errorOf(t.asUser(ADMIN, "select public.save_template_version($1)", [template]));

    expect(error).toContain("TEMPLATE_NEEDS_REQUIRED_TASK");
    expect(await stateOf(template)).toEqual({
      current_version: null,
      has_unpublished_changes: true,
      versions: 0,
      tasks: 3,
      sections: 1,
    });
  });

  it("AC-EDITOR-06: запуск з версії 1 після збереження версії 2 показує «Template version 1» і 5 задач версії 1", async () => {
    const { template, moveIn } = await tenantMoveIn("e0600000");
    const [{ id: runId }] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, '{}') as id", [
      template,
      "Apartment 12, move-in",
    ]);
    await addSixthTask(ADMIN, template, moveIn);
    await t.saveVersion(template);
    expect((await stateOf(template)).current_version).toBe(2);

    const [run] = await t.asUser<{ template_version: number }>(
      MANAGER_A,
      "select template_version from public.runs where id = $1",
      [runId],
    );
    expect(run.template_version).toBe(1);
    const tasks = await t.asUser(MANAGER_A, "select id from public.run_tasks where run_id = $1", [runId]);
    expect(tasks).toHaveLength(5);

    // Новий запуск — уже з поточної версії 2 (6 задач).
    const [{ id: next }] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, '{}') as id", [
      template,
      "Apartment 14, move-in",
    ]);
    const [nextRun] = await t.asUser<{ template_version: number }>(
      MANAGER_A,
      "select template_version from public.runs where id = $1",
      [next],
    );
    expect(nextRun.template_version).toBe(2);
    expect(await t.asUser(MANAGER_A, "select id from public.run_tasks where run_id = $1", [next])).toHaveLength(6);
  });
});

describe("База: шаблон змінює лише адміністратор", () => {
  it("AC-EDITOR-08: менеджер напряму не додає, не змінює й не видаляє задачі й розділи — шаблон на версії 1 з 5 задачами", async () => {
    const { template, before, moveIn } = await tenantMoveIn("e0800000");
    const [task] = await t.asService<{ id: string; name: string }>(
      "select id, name from public.template_tasks where section_id = $1 order by position limit 1",
      [before],
    );

    await expect(addSixthTask(MANAGER_B, template, moveIn)).rejects.toThrow(/row-level security/);
    await expect(
      t.asUser(MANAGER_B, "insert into public.template_sections (template_id, name, position) values ($1, 'X', 3)", [
        template,
      ]),
    ).rejects.toThrow(/row-level security/);
    // update / delete не бачать чужої робочої копії (RLS select + update/delete) — 0 рядків.
    expect(
      await t.asUser(MANAGER_B, "update public.template_tasks set name = 'Hacked' where id = $1 returning id", [task.id]),
    ).toHaveLength(0);
    expect(await t.asUser(MANAGER_B, "delete from public.template_tasks where id = $1 returning id", [task.id])).toHaveLength(
      0,
    );
    expect(
      await t.asUser(MANAGER_B, "delete from public.template_sections where id = $1 returning id", [moveIn]),
    ).toHaveLength(0);

    const state = await stateOf(template);
    expect(state).toEqual({ current_version: 1, has_unpublished_changes: false, versions: 1, tasks: 5, sections: 2 });
    const [same] = await t.asService<{ name: string }>("select name from public.template_tasks where id = $1", [task.id]);
    expect(same.name).toBe(task.name);
  });

  it("AC-EDITOR-08: менеджер напряму не зберігає нову версію і не переставляє задачі — NOT_ALLOWED, нічого не змінено", async () => {
    const { template, before } = await tenantMoveIn("e0810000");
    // Навіть якщо незбережені зміни є (їх зробив адміністратор), менеджер версії не створить.
    await t.asUser(ADMIN, "update public.template_tasks set name = 'Sign the lease (v2)' where section_id = $1 and position = 1", [
      before,
    ]);
    const positions = () =>
      t.asService<{ id: string; position: number }>(
        "select id, position from public.template_tasks where section_id = $1 order by id",
        [before],
      );
    const beforePositions = await positions();
    const [first] = await t.asService<{ id: string }>(
      "select id from public.template_tasks where section_id = $1 and position = 1",
      [before],
    );

    expect(await errorOf(t.asUser(MANAGER_B, "select public.save_template_version($1)", [template]))).toContain(
      "NOT_ALLOWED",
    );
    expect(
      await errorOf(t.asUser(MANAGER_B, "select public.move_template_item('task', $1, 1)", [first.id])),
    ).toContain("NOT_ALLOWED");
    // Колонки позначки й номера версії користувач не змінює (колонкові GRANT).
    expect(
      await errorOf(t.asUser(ADMIN, "update public.templates set current_version = 99 where id = $1", [template])),
    ).toMatch(/permission denied/);
    // Відвідувач без входу не викликає функцій зовсім.
    expect(await errorOf(t.asAnon("select public.save_template_version($1)", [template]))).toMatch(/permission denied/);

    const state = await stateOf(template);
    expect(state.current_version).toBe(1);
    expect(state.versions).toBe(1);
    expect(state.has_unpublished_changes).toBe(true); // зміна адміністратора лишилась незбереженою
    expect(await positions()).toEqual(beforePositions);
    expect(await tasksInVersion(template, 1)).toBe(5);
  });

  it("AC-EDITOR-08: адміністратор переставляє задачу й розділ в обидва боки — зміна стає незбереженою", async () => {
    const { template, before, moveIn } = await tenantMoveIn("e0820000");
    const [first] = await t.asService<{ id: string }>(
      "select id from public.template_tasks where section_id = $1 and position = 1",
      [before],
    );
    const position = async (table: "template_tasks" | "template_sections", id: string) =>
      (await t.asService<{ position: number }>(`select position from public.${table} where id = $1`, [id]))[0].position;

    await t.asUser(ADMIN, "select public.move_template_item('task', $1, 1)", [first.id]);
    expect(await position("template_tasks", first.id)).toBe(2);
    await t.asUser(ADMIN, "select public.move_template_item('task', $1, -1)", [first.id]);
    expect(await position("template_tasks", first.id)).toBe(1);

    // Розділи: unique (template_id, position) — обмін через тимчасову позицію не порушує унікальності.
    await t.asUser(ADMIN, "select public.move_template_item('section', $1, -1)", [moveIn]);
    expect(await position("template_sections", moveIn)).toBe(1);
    expect(await position("template_sections", before)).toBe(2);
    await t.asUser(ADMIN, "select public.move_template_item('section', $1, 1)", [moveIn]);
    expect(await position("template_sections", moveIn)).toBe(2);
    // На краю — нічого не змінюється.
    await t.asUser(ADMIN, "select public.move_template_item('section', $1, 1)", [moveIn]);
    expect(await position("template_sections", moveIn)).toBe(2);

    expect((await stateOf(template)).has_unpublished_changes).toBe(true);
  });
});

describe("База: запуск зі знімка версії", () => {
  it("AC-EDITOR-06: задачу видалено з незбережених змін — запуск з поточної версії все одно має її й призначення", async () => {
    const { template, before } = await tenantMoveIn("e0610000");
    const [first] = await t.asService<{ id: string }>(
      "select id from public.template_tasks where section_id = $1 and position = 1",
      [before],
    );
    // Адміністратор видаляє задачу в редакторі, але версію не зберігає: поточна версія 1 — ті самі 5 задач.
    await t.asUser(ADMIN, "delete from public.template_tasks where id = $1", [first.id]);

    const [{ id: runId }] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, $3) as id", [
      template,
      "Apartment 15, move-in",
      { [first.id]: MANAGER_B },
    ]);

    const tasks = await t.asUser<{ name: string; assignee_id: string }>(
      MANAGER_A,
      "select name, assignee_id from public.run_tasks where run_id = $1",
      [runId],
    );
    expect(tasks).toHaveLength(5);
    expect(tasks.find((task) => task.name === "Sign the lease")?.assignee_id).toBe(MANAGER_B);
  });
});
