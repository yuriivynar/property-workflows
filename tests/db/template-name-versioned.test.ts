// Назва шаблону — частина версії (impl-clarify-template-versions, задача 1) на справжньому Postgres (PGlite):
// робоча назва в template_draft_names лише для адміністратора, перенесення в templates.name і знімок під час збереження,
// «назва зайнята» під час збереження без нової версії.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { messageForTemplateError, templateErrorCode } from "@/lib/templates/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_B: string;

/** Шаблон з 1 розділом і 1 обов'язковою задачею, збережений як версія 1. */
async function savedTemplate(prefix: string, name: string) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const section = `${prefix}-0000-4000-8000-000000000011`;
  await t.asService("insert into public.templates (id, name) values ($1, $2)", [template, name]);
  await t.asService("insert into public.template_sections (id, template_id, name, position) values ($1, $2, 'Before move-in', 1)", [
    section,
    template,
  ]);
  await t.asService(
    "insert into public.template_tasks (template_id, section_id, name, is_required, position) values ($1, $2, 'Sign the lease', true, 1)",
    [template, section],
  );
  await t.saveVersion(template);
  return template;
}

/** Як дія renameTemplate: адміністратор пише робочу назву. */
const renameAsAdmin = (template: string, name: string) =>
  t.asUser(ADMIN, "insert into public.template_draft_names (template_id, name) values ($1, $2)", [template, name]);

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error & { code?: string }) => ({ message: e.message, code: e.code }),
  );

async function stateOf(template: string) {
  const [row] = await t.asService<{
    name: string;
    draft: string | null;
    current_version: number;
    has_unpublished_changes: boolean;
    versions: number;
  }>(
    `select t.name, d.name as draft, t.current_version, t.has_unpublished_changes,
            (select count(*)::int from public.template_versions where template_id = t.id) as versions
     from public.templates as t left join public.template_draft_names as d on d.template_id = t.id
     where t.id = $1`,
    [template],
  );
  return row;
}

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: назва шаблону — частина версії", () => {
  it("AC-EDITOR-21: перейменування на «Tenant move-in (2026)» діє з версією 2 — до збереження менеджер B бачить стару назву", async () => {
    const template = await savedTemplate("e2100000", "Tenant move-in e21");
    await renameAsAdmin(template, "Tenant move-in (2026)");

    // До збереження: позначка є, менеджер бачить назву версії 1 і не бачить робочої назви.
    expect(await stateOf(template)).toMatchObject({ name: "Tenant move-in e21", has_unpublished_changes: true });
    const [beforeSave] = await t.asUser<{ name: string }>(MANAGER_B, "select name from public.templates where id = $1", [
      template,
    ]);
    expect(beforeSave.name).toBe("Tenant move-in e21");
    expect(
      await t.asUser(MANAGER_B, "select name from public.template_draft_names where template_id = $1", [template]),
    ).toHaveLength(0);

    expect(await t.saveVersion(template)).toBe(2);

    const [version] = await t.asService<{ name: string }>(
      "select content ->> 'name' as name from public.template_versions where template_id = $1 and number = 2",
      [template],
    );
    expect(version.name).toBe("Tenant move-in (2026)");
    const [afterSave] = await t.asUser<{ name: string }>(MANAGER_B, "select name from public.templates where id = $1", [
      template,
    ]);
    expect(afterSave.name).toBe("Tenant move-in (2026)");
    expect(await stateOf(template)).toMatchObject({ draft: null, has_unpublished_changes: false, current_version: 2 });
  });

  it("AC-EDITOR-24: «Repair» перейменовано на «Tenant move-in» — «назва зайнята», нової версії немає, зміни й позначка лишаються", async () => {
    // «Tenant move-in» — довідковий шаблон з міграції 20261020115709_workflow_templates_reference_data.sql.
    const repair = await savedTemplate("e2400000", "Repair e24");
    await renameAsAdmin(repair, "Tenant move-in");

    const error = await errorOf(t.saveVersion(repair));

    expect(messageForTemplateError(templateErrorCode(error))).toBe("A template with this name already exists");
    expect(await stateOf(repair)).toEqual({
      name: "Repair e24",
      draft: "Tenant move-in",
      current_version: 1,
      has_unpublished_changes: true,
      versions: 1,
    });
  });

  it("AC-EDITOR-29: менеджер B напряму не читає й не пише робочу назву шаблону — назва без змін", async () => {
    const template = await savedTemplate("e2910000", "Tenant move-in e29");
    await renameAsAdmin(template, "Draft name e29");

    for (const sql of [
      "insert into public.template_draft_names (template_id, name) values ($1, 'Hacked')",
      "update public.template_draft_names set name = 'Hacked' where template_id = $1 returning 1",
      "delete from public.template_draft_names where template_id = $1 returning 1",
    ]) {
      const result = await t.asUser(MANAGER_B, sql, [template]).then(
        (rows) => rows.length,
        (e: Error & { code?: string }) => e.code,
      );
      // insert — відмова RLS (42501); update/delete — рядків не видно, тож 0 змінених.
      expect([0, "42501"], sql).toContain(result);
    }
    expect(await stateOf(template)).toMatchObject({ name: "Tenant move-in e29", draft: "Draft name e29" });
  });

  it("AC-EDITOR-22: запуск з версії 1 показує «Tenant move-in e22», запуск з версії 2 — «Tenant move-in e22 (2026)»", async () => {
    const template = await savedTemplate("e2200000", "Tenant move-in e22");
    const launch = (caseName: string, version: number) =>
      t.asUser<{ id: string }>(MANAGER_B, "select public.launch_run($1, $2, '{}'::jsonb, $3) as id", [
        template,
        caseName,
        version,
      ]);
    const [{ id: runV1 }] = await launch("Apartment 12, move-in", 1);
    await renameAsAdmin(template, "Tenant move-in e22 (2026)");
    expect(await t.saveVersion(template)).toBe(2);
    const [{ id: runV2 }] = await launch("Apartment 14, move-in", 2);

    // Назва з AC зайнята тестом AC-EDITOR-21 у цій самій базі, тому — з суфіксом.
    // launch_run не змінювали: templates.name — завжди назва поточної версії, і запуск копіює її в template_name.
    const rows = await t.asUser<{ id: string; template_name: string; template_version: number }>(
      MANAGER_B,
      "select id, template_name, template_version from public.runs where id in ($1, $2)",
      [runV1, runV2],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[runV1]).toMatchObject({ template_name: "Tenant move-in e22", template_version: 1 });
    expect(byId[runV2]).toMatchObject({ template_name: "Tenant move-in e22 (2026)", template_version: 2 });
  });
});
