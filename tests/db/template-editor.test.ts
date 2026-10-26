// Редактор шаблону на рівні бази: незбережені зміни, список версій і права (PGlite з усіма міграціями).
// Покриває AC-EDITOR-01, AC-EDITOR-05, AC-EDITOR-07, AC-EDITOR-09 у docs/conformance.md.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";

let t: TestDb;
let ADMIN: string, ADMIN_C: string, MANAGER_A: string, MANAGER_B: string;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  ADMIN_C = t.users["pm-admin@example.test"]; // другий адміністратор («administrator C» з AC-EDITOR-05)
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

/** Новий шаблон із розділом і однією обов'язковою задачею, створений як дії редактора адміністратора. */
async function newTemplate(name: string) {
  const [{ id }] = await t.asUser<{ id: string }>(ADMIN, "insert into public.templates (name) values ($1) returning id", [
    name,
  ]);
  const [{ id: section }] = await t.asUser<{ id: string }>(
    ADMIN,
    "insert into public.template_sections (template_id, name, position) values ($1, 'Move-in day', 1) returning id",
    [id],
  );
  await t.asUser(
    ADMIN,
    "insert into public.template_tasks (template_id, section_id, name, is_required, position) values ($1, $2, 'Hand over the keys', true, 1)",
    [id, section],
  );
  return { id, section };
}

describe("База: редактор шаблону", () => {
  it("AC-EDITOR-01: шоста задача лишається після виходу без збереження — позначка «Unpublished changes», 6 задач у редакторі", async () => {
    const [moveIn] = await t.asService<{ id: string }>(
      "select id from public.template_sections where template_id = $1 and name = 'Move-in day'",
      [TENANT_MOVE_IN],
    );
    // Дія addTask: запис одразу — окремого «зберегти чернетку» немає.
    await t.asUser(
      ADMIN,
      `insert into public.template_tasks (template_id, section_id, name, is_required, position)
       values ($1, $2, 'Sign handover act', false, 9)`,
      [TENANT_MOVE_IN, moveIn.id],
    );

    // «Повторно відкрити редактор» — нова транзакція того самого адміністратора.
    const [state] = await t.asUser<{ has_unpublished_changes: boolean; tasks: number; current_version: number }>(
      ADMIN,
      `select t.has_unpublished_changes, t.current_version,
              (select count(*)::int from public.template_tasks where template_id = t.id) as tasks
       from public.templates as t where t.id = $1`,
      [TENANT_MOVE_IN],
    );
    expect(state).toEqual({ has_unpublished_changes: true, tasks: 6, current_version: 1 });
  });

  it("AC-EDITOR-05: список версій — версія 2 (адміністратор C) перша, версія 1 (адміністратор A) друга, з датою й автором", async () => {
    const { id, section } = await newTemplate("Versions order");
    await t.asUser(ADMIN, "select public.save_template_version($1)", [id]);
    await t.asUser(ADMIN_C, "update public.template_tasks set name = 'Hand over all keys' where section_id = $1", [section]);
    await t.asUser(ADMIN_C, "select public.save_template_version($1)", [id]);

    const versions = await t.asUser<{ number: number; email: string; created_at: string }>(
      ADMIN,
      `select v.number, p.email, v.created_at
       from public.template_versions as v left join public.profiles as p on p.id = v.created_by
       where v.template_id = $1 order by v.number desc`,
      [id],
    );
    expect(versions.map((v) => [v.number, v.email])).toEqual([
      [2, "pm-admin@example.test"],
      [1, "admin@example.test"],
    ]);
    expect(versions.every((v) => Boolean(v.created_at))).toBe(true);
  });

  it("AC-EDITOR-07: менеджер не бачить списку версій — лише поточну, жодної старої", async () => {
    const { id, section } = await newTemplate("Manager versions");
    await t.saveVersion(id);
    await t.asUser(ADMIN, "update public.template_tasks set name = 'Changed' where section_id = $1", [section]);
    await t.saveVersion(id);

    const asManager = await t.asUser<{ number: number }>(
      MANAGER_B,
      "select number from public.template_versions where template_id = $1 order by number",
      [id],
    );
    expect(asManager.map((v) => v.number)).toEqual([2]); // лише поточна — для запуску; список версій для нього порожній
    const all = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.template_versions where template_id = $1",
      [id],
    );
    expect(all[0].n).toBe(2); // обидві версії існують
  });

  it("AC-EDITOR-09: відвідувач без входу не читає жодного вмісту шаблону й нічого не змінює", async () => {
    for (const table of ["templates", "template_sections", "template_tasks", "template_versions"]) {
      await expect(t.asAnon(`select * from public.${table} limit 1`)).rejects.toThrow(/permission denied/);
    }
    await expect(
      t.asAnon("insert into public.templates (name) values ('Anonymous')"),
    ).rejects.toThrow(/permission denied/);
    const [row] = await t.asService<{ n: number }>("select count(*)::int as n from public.templates where name = 'Anonymous'");
    expect(row.n).toBe(0);
  });

  it("AC-EDITOR-07: менеджер не бачить незбереженого шаблону ні в списку, ні його версій", async () => {
    const { id } = await newTemplate("Never saved for manager");
    expect(await t.asUser(MANAGER_A, "select id from public.templates where id = $1", [id])).toHaveLength(0);
    expect(await t.asUser(MANAGER_A, "select id from public.template_versions where template_id = $1", [id])).toHaveLength(0);
  });
});
