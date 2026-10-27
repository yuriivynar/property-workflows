// Порожні назви не дають зберегти версію (impl-clarify-template-versions, задача 2) на справжньому Postgres (PGlite):
// очищена назва лишається в незбережених змінах, save_template_version відхиляє збереження, а знімок версії ніколи не
// має порожньої назви.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { messageForTemplateError, templateErrorCode } from "@/lib/templates/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string;

/** «Tenant move-in» з AC: 2 розділи, 5 задач (3 обов'язкові), збережений як версія 1. */
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
  return { template, before, keys };
}

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error & { code?: string }) => ({ message: e.message, code: e.code }),
  );

async function stateOf(template: string) {
  const [row] = await t.asService<{ current_version: number; has_unpublished_changes: boolean; versions: number }>(
    `select t.current_version, t.has_unpublished_changes,
            (select count(*)::int from public.template_versions where template_id = t.id) as versions
     from public.templates as t where t.id = $1`,
    [template],
  );
  return row;
}

/** Порожні назви в усіх знімках шаблону — їх не має бути ніколи. */
const blankNamesInVersions = async (template: string) =>
  (
    await t.asService<{ n: number }>(
      `select count(*)::int as n from public.template_versions as v,
         jsonb_array_elements(v.content -> 'sections') as s
       where v.template_id = $1
         and (btrim(s ->> 'name') = '' or exists (
           select 1 from jsonb_array_elements(s -> 'tasks') as tk where btrim(tk ->> 'name') = ''))`,
      [template],
    )
  )[0].n;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: порожні назви й збереження версії", () => {
  it("AC-EDITOR-20: задача з очищеною назвою — «Every section and task needs a name», версії 2 немає, зміни й позначка лишаються", async () => {
    const { template, keys } = await tenantMoveIn("e2000000");
    // Як дія renameTask: очищена назва лишається в незбережених змінах.
    await t.asUser(ADMIN, "update public.template_tasks set name = '' where id = $1", [keys]);

    const error = await errorOf(t.saveVersion(template));

    expect(messageForTemplateError(templateErrorCode(error))).toBe("Every section and task needs a name");
    expect(await stateOf(template)).toEqual({ current_version: 1, has_unpublished_changes: true, versions: 1 });
    const [task] = await t.asService<{ name: string }>("select name from public.template_tasks where id = $1", [keys]);
    expect(task.name).toBe("");
  });

  it("AC-EDITOR-20: розділ з назвою лише з пробілів теж не дає зберегти; після виправлення версія 2 без порожніх назв", async () => {
    const { template, before } = await tenantMoveIn("e2010000");
    await t.asUser(ADMIN, "update public.template_sections set name = '   ' where id = $1", [before]);

    expect(templateErrorCode(await errorOf(t.saveVersion(template)))).toBe("TEMPLATE_NAME_MISSING");
    expect((await stateOf(template)).versions).toBe(1);

    await t.asUser(ADMIN, "update public.template_sections set name = 'Before move-in' where id = $1", [before]);
    expect(await t.saveVersion(template)).toBe(2);
    expect(await blankNamesInVersions(template)).toBe(0);
  });
});
