// Правила шаблонів за рев'ю WS7 (koldovsky/2026-quitcode-07-fullstack-hw#5, міграція 20261115134842_ws7_review_template_rules.sql)
// на справжньому Postgres (PGlite): позначку незбережених змін бачить лише адміністратор; «порожня назва» в базі — той
// самий набір пробільних символів, що й trim() у дії; позиція задачі унікальна в розділі.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { templateErrorCode } from "@/lib/templates/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_B: string;

const NBSP = " ";
const TAB = "\t";

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: Error & { code?: string }) => ({ message: e.message, code: e.code }),
  );

/** Шаблон з одним розділом і двома задачами (позиції 1 і 2), збережений як версія 1, і одна незбережена зміна. */
async function templateWithChanges(prefix: string) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const section = `${prefix}-0000-4000-8000-000000000011`;
  await t.asService("insert into public.templates (id, name) values ($1, $2)", [template, `Review ${prefix}`]);
  await t.asService("insert into public.template_sections (id, template_id, name, position) values ($1, $2, 'Repairs', 1)", [
    section,
    template,
  ]);
  await t.asService(
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
       ($1, $2, 'Inspect the boiler', true, 1), ($1, $2, 'Order a part', false, 2)`,
    [template, section],
  );
  await t.saveVersion(template);
  await t.asUser(ADMIN, "update public.template_tasks set name = 'Order two parts' where section_id = $1 and position = 2", [
    section,
  ]);
  return { template, section };
}

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: позначка незбережених змін — лише адміністратору", () => {
  it("AC-EDITOR-29: менеджер B напряму не дізнається, що в шаблоні є незбережені зміни — ні колонки, ні функції", async () => {
    const { template } = await templateWithChanges("f2900000");

    const direct = await errorOf(
      t.asUser(MANAGER_B, "select has_unpublished_changes from public.templates where id = $1", [template]),
    );
    expect(direct?.code).toBe("42501");
    expect(await t.asUser(MANAGER_B, "select id from public.templates_with_unpublished_changes()")).toEqual([]);
    // Поточна версія менеджеру й далі доступна — забрано лише позначку.
    expect(await t.asUser(MANAGER_B, "select id, current_version from public.templates where id = $1", [template])).toEqual([
      { id: template, current_version: 1 },
    ]);
  });

  it("AC-EDITOR-01: адміністратор бачить позначку незбережених змін через templates_with_unpublished_changes()", async () => {
    const { template } = await templateWithChanges("f0100000");

    const ids = (await t.asUser<{ id: string }>(ADMIN, "select id from public.templates_with_unpublished_changes()")).map(
      (row) => row.id,
    );
    expect(ids).toContain(template);
  });
});

describe("База: «порожня назва» — той самий набір пробільних символів, що trim()", () => {
  it.each([
    ["нерозривний пробіл", NBSP],
    ["табуляція", TAB],
    ["пробіли й нерозривний пробіл", ` ${NBSP} `],
  ])("AC-EDITOR-19: назва нового шаблону лише з пробільних символів (%s) напряму в базу — шаблон не створено", async (_, name) => {
    const before = await t.asService<{ n: number }>("select count(*)::int as n from public.templates");

    const error = await errorOf(t.asUser(ADMIN, "insert into public.templates (name) values ($1)", [name]));

    expect(error?.code).toBe("23514");
    expect(templateErrorCode(error)).toBe("TEMPLATE_NAME_REQUIRED");
    expect(await t.asService("select count(*)::int as n from public.templates")).toEqual(before);
  });

  it("AC-EDITOR-23: «Tenant move-in» з табуляцією чи нерозривним пробілом на краях напряму в базу — «назва зайнята»", async () => {
    for (const name of [`Tenant move-in${TAB}`, `${NBSP}tenant MOVE-IN`]) {
      const error = await errorOf(t.asUser(ADMIN, "insert into public.templates (name) values ($1)", [name]));
      expect(templateErrorCode(error), JSON.stringify(name)).toBe("NAME_TAKEN");
    }
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.templates where lower(private.clean_name(name)) = 'tenant move-in'",
    );
    expect(n).toBe(1);
  });

  it("AC-EDITOR-20: задача з назвою лише з нерозривного пробілу не дає зберегти версію — «Every section and task needs a name»", async () => {
    const { template, section } = await templateWithChanges("f2000000");
    await t.asUser(ADMIN, "update public.template_tasks set name = $1 where section_id = $2 and position = 2", [NBSP, section]);

    const error = await errorOf(t.saveVersion(template));

    expect(templateErrorCode(error)).toBe("TEMPLATE_NAME_MISSING");
    const [{ current_version }] = await t.asService<{ current_version: number }>(
      "select current_version from public.templates where id = $1",
      [template],
    );
    expect(current_version).toBe(1);
  });
});

describe("База: позиція задачі унікальна в розділі", () => {
  it("дві задачі одного розділу з однаковою позицією (два швидкі додавання) — друга не записується", async () => {
    const { template, section } = await templateWithChanges("f0800000");

    const error = await errorOf(
      t.asUser(
        ADMIN,
        `insert into public.template_tasks (template_id, section_id, name, is_required, position)
         values ($1, $2, 'Call the tenant', false, 2)`,
        [template, section],
      ),
    );

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("template_tasks_section_position_key");
    const rows = await t.asService<{ position: number }>(
      "select position from public.template_tasks where section_id = $1 order by position",
      [section],
    );
    expect(rows.map((row) => row.position)).toEqual([1, 2]);
  });
});

// Наявні дані, які старі правила (btrim, без унікальної позиції) пропускали, а нові вважають порожніми чи дублікатами:
// міграція має застосуватися й виправити їх, а не впасти на db-deploy (рев'ю CodeRabbit, PR #80).
describe("Міграція 20261115134842 на наявних даних", () => {
  let old: TestDb;
  const TPL = "f9000000-0000-4000-8000-000000000001";
  const BLANK = "f9000000-0000-4000-8000-000000000002";
  const TWIN = "f9000000-0000-4000-8000-000000000003";
  const SECTION = "f9000000-0000-4000-8000-000000000011";

  beforeAll(async () => {
    old = await createTestDb({ stopBefore: "20261115134842_ws7_review_template_rules.sql" });
  }, 60_000);

  afterAll(async () => {
    await old.db.close();
  });

  it("назви з табуляцією чи U+00A0 і дві групи однакових позицій — міграція проходить, дані під новими правилами", async () => {
    await old.asService("insert into public.templates (id, name) values ($1, $2), ($3, $4), ($5, $6)", [
      TPL,
      `Repair checklist${TAB}`,
      BLANK,
      NBSP,
      TWIN,
      `Tenant move-in${TAB}`,
    ]);
    await old.asService("insert into public.template_draft_names (template_id, name) values ($1, $2)", [TPL, ` ${NBSP} `]);
    await old.asService("insert into public.template_sections (id, template_id, name, position) values ($1, $2, 'Repairs', 1)", [
      SECTION,
      TPL,
    ]);
    // Позиції [1, 1, 2, 2]: дві групи дублікатів в одному розділі.
    await old.asService(
      `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
         ($1, $2, 'A', true, 1), ($1, $2, 'B', false, 1), ($1, $2, 'C', false, 2), ($1, $2, 'D', false, 2)`,
      [TPL, SECTION],
    );

    await old.migrateRest();

    const names = await old.asService<{ id: string; name: string }>(
      "select id, name from public.templates where id = any($1::uuid[]) order by id",
      [[TPL, BLANK, TWIN]],
    );
    expect(names).toEqual([
      { id: TPL, name: "Repair checklist" },
      { id: BLANK, name: "Untitled template f9000000" },
      { id: TWIN, name: "Tenant move-in (f9000000)" },
    ]);
    expect(await old.asService("select 1 from public.template_draft_names where template_id = $1", [TPL])).toEqual([]);
    const positions = await old.asService<{ position: number }>(
      "select position from public.template_tasks where section_id = $1 order by position",
      [SECTION],
    );
    expect(positions.map((row) => row.position)).toEqual([1, 2, 3, 4]);
  });
});
