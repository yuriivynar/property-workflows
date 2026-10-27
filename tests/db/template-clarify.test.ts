// Правила шаблонів після відповідей PM 27.10 (зміна clarify-template-versions) на справжньому Postgres (PGlite):
// незбережений шаблон не запускається й не видний менеджеру, збереження без змін і з порожнім розділом відхилено,
// унікальна назва без урахування регістру, прямі запити без входу й без прав, старі запуски — версія 1.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanName, templateErrorCode } from "@/lib/templates/domain";
import { templateVersionLabel } from "@/lib/templates/version";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_B: string;

/** «Tenant move-in» з AC: 2 розділи, 5 задач (3 обов'язкові) у робочій копії, ще не збережений. */
async function tenantMoveInDraft(db: TestDb, prefix: string, name = `Tenant move-in ${prefix}`) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const before = `${prefix}-0000-4000-8000-000000000011`;
  const moveIn = `${prefix}-0000-4000-8000-000000000012`;
  await db.asService("insert into public.templates (id, name) values ($1, $2)", [template, name]);
  await db.asService(
    "insert into public.template_sections (id, template_id, name, position) values ($1, $3, 'Before move-in', 1), ($2, $3, 'Move-in day', 2)",
    [before, moveIn, template],
  );
  await db.asService(
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
       ($1, $2, 'Sign the lease', true, 1), ($1, $2, 'Collect the deposit', true, 2),
       ($1, $3, 'Hand over the keys', true, 1), ($1, $3, 'Record meter readings', false, 2), ($1, $3, 'Order cleaning', false, 3)`,
    [template, before, moveIn],
  );
  return { template, before, moveIn };
}

/** Той самий шаблон, збережений як версія 1. */
async function tenantMoveIn(prefix: string) {
  const ids = await tenantMoveInDraft(t, prefix);
  await t.saveVersion(ids.template);
  return ids;
}

const addTask = (template: string, section: string, name: string, position: number) =>
  t.asUser(
    ADMIN,
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values ($1, $2, $3, false, $4)`,
    [template, section, name, position],
  );

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error & { code?: string }) => ({ message: e.message, code: e.code }),
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

const runCount = async () => (await t.asService<{ n: number }>("select count(*)::int as n from public.runs"))[0].n;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: правила шаблонів після уточнень PM", () => {
  it("AC-EDITOR-11: прямий запуск незбереженого «Repair» відхилено — запуску немає, список запусків не змінився", async () => {
    const { template } = await tenantMoveInDraft(t, "e1100000", "Repair e1100000");
    const before = await runCount();

    const error = await errorOf(
      t.asUser(ADMIN, "select public.launch_run($1, 'Apartment 3, repair', '{}'::jsonb, null)", [template]),
    );

    expect(error).not.toBeNull();
    expect(await runCount()).toBe(before);
  });

  it("AC-EDITOR-12: збереження без незбережених змін (поточна версія 2) — версії 3 немає, поточна лишається 2", async () => {
    const { template, moveIn } = await tenantMoveIn("e1200000");
    await addTask(template, moveIn, "Sign handover act", 4);
    expect(await t.saveVersion(template)).toBe(2);

    const error = await errorOf(t.saveVersion(template));

    expect(error?.message).toContain("NO_UNPUBLISHED_CHANGES");
    const state = await stateOf(template);
    expect(state.current_version).toBe(2);
    expect(state.versions).toBe(2);
  });

  it("AC-EDITOR-15: третій розділ «After move-in» без задач — версію 2 не створено, незбережені зміни й позначка лишаються", async () => {
    const { template } = await tenantMoveIn("e1500000");
    await t.asUser(
      ADMIN,
      "insert into public.template_sections (template_id, name, position) values ($1, 'After move-in', 3)",
      [template],
    );

    const error = await errorOf(t.saveVersion(template));

    expect(templateErrorCode(error)).toBe("TEMPLATE_SECTION_EMPTY");
    expect(await stateOf(template)).toEqual({
      current_version: 1,
      has_unpublished_changes: true,
      versions: 1,
      tasks: 5,
      sections: 3,
    });
  });

  it("AC-EDITOR-16: менеджер B за прямим посиланням на незбережений «Repair» — ні шаблону, ні розділів, ні задач", async () => {
    const { template } = await tenantMoveInDraft(t, "e1600000", "Repair e1600000");

    for (const table of ["templates", "template_sections", "template_tasks", "template_versions"]) {
      const column = table === "templates" ? "id" : "template_id";
      const rows = await t.asUser(MANAGER_B, `select 1 from public.${table} where ${column} = $1`, [template]);
      expect(rows, table).toHaveLength(0);
    }
  });

  it("AC-EDITOR-23: новий шаблон « tenant MOVE-IN » при наявному «Tenant move-in» не створено — «назва зайнята»", async () => {
    // «Tenant move-in» — довідковий шаблон з міграції 20261020115709_workflow_templates_reference_data.sql.
    const name = cleanName(" tenant MOVE-IN "); // як дія createTemplate: пробіли на краях обрізано

    const error = await errorOf(t.asUser(ADMIN, "insert into public.templates (name) values ($1)", [name]));

    expect(templateErrorCode(error)).toBe("NAME_TAKEN");
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.templates where lower(btrim(name)) = 'tenant move-in'",
    );
    expect(n).toBe(1);
  });

  it("AC-EDITOR-26: відвідувач без входу напряму не змінює шаблон і не зберігає версію — версія 1, 5 задач, без змін", async () => {
    const { template, moveIn } = await tenantMoveIn("e2600000");

    // Послідовно й кожна — власною відмовою в правах (42501), а не наслідком попередньої помилки (рев'ю CodeRabbit, PR #23).
    const attempts: [string, unknown[]][] = [
      [
        "insert into public.template_tasks (template_id, section_id, name, is_required, position) values ($1, $2, 'Sign handover act', false, 4)",
        [template, moveIn],
      ],
      ["update public.templates set name = 'Hacked' where id = $1", [template]],
      ["delete from public.template_tasks where template_id = $1", [template]],
      ["select public.save_template_version($1)", [template]],
    ];
    for (const [sql, params] of attempts) {
      expect((await errorOf(t.asAnon(sql, params)))?.code, sql).toBe("42501");
    }

    // Нічого про шаблон не показано.
    expect(await t.asAnon("select id from public.templates where id = $1", [template]).catch(() => [])).toHaveLength(0);
    expect(await stateOf(template)).toEqual({
      current_version: 1,
      has_unpublished_changes: false,
      versions: 1,
      tasks: 5,
      sections: 2,
    });
  });

  it("AC-EDITOR-29: менеджер B напряму запитує версію 1, список версій і незбережені зміни — отримує лише поточну версію 2", async () => {
    const { template, moveIn } = await tenantMoveIn("e2900000");
    await addTask(template, moveIn, "Sign handover act", 4);
    await t.saveVersion(template); // версія 2 — 6 задач
    await addTask(template, moveIn, "Check smoke detectors", 5); // незбережені зміни — 7 задач

    const v1 = await t.asUser(MANAGER_B, "select number from public.template_versions where template_id = $1 and number = 1", [
      template,
    ]);
    expect(v1).toHaveLength(0);
    const versions = await t.asUser<{ number: number }>(
      MANAGER_B,
      "select number from public.template_versions where template_id = $1",
      [template],
    );
    expect(versions).toEqual([{ number: 2 }]);
    expect(
      await t.asUser(MANAGER_B, "select id from public.template_tasks where template_id = $1", [template]),
    ).toHaveLength(0);
    expect(
      await t.asUser(MANAGER_B, "select id from public.template_sections where template_id = $1", [template]),
    ).toHaveLength(0);

    expect(await stateOf(template)).toMatchObject({ current_version: 2, has_unpublished_changes: true, tasks: 7 });
  });
});

describe("База: запуски, створені до появи версій", () => {
  let old: TestDb;

  beforeAll(async () => {
    old = await createTestDb({ stopBefore: "20261026133459_template_versions.sql" });
  }, 60_000);

  afterAll(async () => {
    await old.db.close();
  });

  it("AC-EDITOR-27: запуск «Apartment 12, move-in» до появи версій після міграції показує «Template version 1» і ті самі задачі", async () => {
    const manager = old.users["manager.a@example.test"];
    // «Tenant move-in» — довідковий шаблон, що існував до версій (міграція 20261020115709).
    const [{ id: template }] = await old.asService<{ id: string }>(
      "select id from public.templates where name = 'Tenant move-in'",
    );
    // Як було до версій: launch_run з трьома аргументами, задачі — з робочої копії шаблону.
    const [{ id: run }] = await old.asUser<{ id: string }>(
      manager,
      "select public.launch_run($1, 'Apartment 12, move-in', '{}'::jsonb) as id",
      [template],
    );
    const tasksOf = () =>
      old.asUser<{ name: string }>(manager, "select name from public.run_tasks where run_id = $1 order by name", [run]);
    const tasksBefore = await tasksOf();
    expect(tasksBefore).toHaveLength(5);

    await old.migrateRest();

    const [row] = await old.asUser<{ template_version: number }>(
      manager,
      "select template_version from public.runs where id = $1",
      [run],
    );
    expect(templateVersionLabel(row.template_version)).toBe("Template version 1");
    expect(await tasksOf()).toEqual(tasksBefore);
  });
});
