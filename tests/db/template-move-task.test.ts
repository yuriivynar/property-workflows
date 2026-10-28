// Перенесення задачі в інший розділ (impl-clarify-template-versions, задача 4) на справжньому Postgres (PGlite):
// функція move_template_task_to_section — лише адміністратор, лише розділ того самого шаблону; нова версія — після
// збереження.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_B: string;

/** «Tenant move-in» з AC: «Before move-in» (2 задачі) і «Move-in day» (3 задачі), збережений як версія 1. */
async function tenantMoveIn(prefix: string) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const before = `${prefix}-0000-4000-8000-000000000011`;
  const moveIn = `${prefix}-0000-4000-8000-000000000012`;
  const keys = `${prefix}-0000-4000-8000-000000000021`;
  await t.asService("insert into public.templates (id, name) values ($1, $2)", [template, `Tenant move-in ${prefix}`]);
  await t.asService(
    "insert into public.template_sections (id, template_id, name, position) values ($1, $3, 'Before move-in', 1), ($2, $3, 'Move-in day', 2)",
    [before, moveIn, template],
  );
  await t.asService(
    `insert into public.template_tasks (id, template_id, section_id, name, is_required, position) values
       ($3, $1, $2, 'Hand over the keys', true, 1)`,
    [template, moveIn, keys],
  );
  await t.asService(
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
       ($1, $2, 'Sign the lease', true, 1), ($1, $2, 'Collect the deposit', true, 2),
       ($1, $3, 'Record meter readings', false, 2), ($1, $3, 'Order cleaning', false, 3)`,
    [template, before, moveIn],
  );
  await t.saveVersion(template);
  return { template, before, moveIn, keys };
}

const move = (userId: string, task: string, section: string) =>
  t.asUser(userId, "select public.move_template_task_to_section($1, $2)", [task, section]);

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error & { code?: string }) => ({ message: e.message, code: e.code }),
  );

/** Розділи робочої копії: назва → назви задач за позицією. */
async function draftOf(template: string) {
  const rows = await t.asService<{ section: string; tasks: string[] }>(
    `select s.name as section,
            coalesce((select array_agg(tt.name order by tt.position) from public.template_tasks as tt where tt.section_id = s.id), '{}') as tasks
     from public.template_sections as s where s.template_id = $1 order by s.position`,
    [template],
  );
  return Object.fromEntries(rows.map((r) => [r.section, r.tasks]));
}

/** Кількість задач у кожному розділі знімка версії. */
async function versionOf(template: string, number: number) {
  const rows = await t.asService<{ section: string; tasks: number }>(
    `select s ->> 'name' as section, jsonb_array_length(s -> 'tasks') as tasks
     from public.template_versions as v, jsonb_array_elements(v.content -> 'sections') as s
     where v.template_id = $1 and v.number = $2`,
    [template, number],
  );
  return Object.fromEntries(rows.map((r) => [r.section, r.tasks]));
}

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: перенесення задачі в інший розділ", () => {
  it("AC-EDITOR-28: задачу перенесено з «Move-in day» у «Before move-in» і збережено — «Before move-in» 3 задачі, «Move-in day» 2", async () => {
    const { template, before, keys } = await tenantMoveIn("e2800000");

    await move(ADMIN, keys, before);

    // Задача — остання в цільовому розділі; позиції у вихідному розділі стиснуто.
    expect(await draftOf(template)).toEqual({
      "Before move-in": ["Sign the lease", "Collect the deposit", "Hand over the keys"],
      "Move-in day": ["Record meter readings", "Order cleaning"],
    });
    const positions = await t.asService<{ position: number }>(
      "select tt.position from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id where s.template_id = $1 and s.name = 'Move-in day' order by tt.position",
      [template],
    );
    expect(positions.map((p) => p.position)).toEqual([1, 2]);

    expect(await t.saveVersion(template)).toBe(2);
    expect(await versionOf(template, 2)).toEqual({ "Before move-in": 3, "Move-in day": 2 });
    expect(await versionOf(template, 1)).toEqual({ "Before move-in": 2, "Move-in day": 3 });
  });

  it("AC-EDITOR-28: менеджер B напряму не переносить задачу, розділ іншого шаблону відхилено — робоча копія без змін", async () => {
    const { template, before, keys } = await tenantMoveIn("e2810000");
    const other = await tenantMoveIn("e2820000");
    const unchanged = await draftOf(template);

    expect((await errorOf(move(MANAGER_B, keys, before)))?.code).toBe("42501");
    expect((await errorOf(move(ADMIN, keys, other.before)))?.message).toContain("TEMPLATE_ITEM_NOT_FOUND");

    expect(await draftOf(template)).toEqual(unchanged);
    const [{ flag }] = await t.asService<{ flag: boolean }>(
      "select has_unpublished_changes as flag from public.templates where id = $1",
      [template],
    );
    expect(flag).toBe(false);
  });
});
