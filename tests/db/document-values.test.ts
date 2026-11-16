// Підтверджені значення документа (run_document_values) — правила бази на справжньому Postgres (PGlite) з усіма
// міграціями: хто читає й пише (адміністратор і менеджер запуску; варіант A solomchaak/property-workflows-spec#53),
// хто ставить confirmed_by, і що запис незмінний (AC-DOCAI-08; openspec/specs/document-parsing).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
const REQUEST = {
  phone: "555-0101",
  description: "Kitchen tap in apartment 12 has been dripping for three days",
  category: "plumbing",
  urgency: "not urgent",
  notes: [],
};

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string, VENDOR: string;
let RUN: string;

const insertAs = (userId: string, runId: string, extra = "") =>
  t
    .asUser(
      userId,
      `insert into public.run_document_values (run_id, kind, fields${extra ? ", confirmed_by" : ""})
       values ($1, 'request', $2${extra ? ", $3" : ""})`,
      extra ? [runId, REQUEST, extra] : [runId, REQUEST],
    )
    .then(
      () => "",
      (e: Error) => e.message,
    );

const visibleTo = async (userId: string) =>
  (await t.asUser<{ id: string }>(userId, "select id from public.run_document_values where run_id = $1", [RUN])).length;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  VENDOR = t.users["vendor@example.test"];
  const [first] = await t.asService<{ id: string }>(
    `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
     where tt.template_id = $1 order by s.position, tt.position limit 1`,
    [TENANT_MOVE_IN],
  );
  // Запуск менеджера A; першу задачу призначено вендору, другу — менеджеру B: обидва бачать запуск, але не є його менеджером.
  const [second] = await t.asService<{ id: string }>(
    `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
     where tt.template_id = $1 order by s.position, tt.position offset 1 limit 1`,
    [TENANT_MOVE_IN],
  );
  const [row] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, $3) as id", [
    TENANT_MOVE_IN,
    "Apartment 12, document values",
    { [first.id]: VENDOR, [second.id]: MANAGER_B },
  ]);
  RUN = row.id;
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("run_document_values: хто зберігає й бачить підтверджені значення", () => {
  it("AC-DOCAI-08: менеджер запуску зберігає значення; confirmed_by і confirmed_at ставить база", async () => {
    expect(await insertAs(MANAGER_A, RUN)).toBe("");
    const rows = await t.asService<{ confirmed_by: string; kind: string; fields: unknown; confirmed_at: string }>(
      "select confirmed_by, kind, fields, confirmed_at from public.run_document_values where run_id = $1",
      [RUN],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ confirmed_by: MANAGER_A, kind: "request", fields: REQUEST });
    expect(rows[0].confirmed_at).toBeTruthy();
    expect(await visibleTo(MANAGER_A)).toBe(1);
  });

  it("AC-DOCAI-08: адміністратор зберігає й бачить значення будь-якого запуску", async () => {
    expect(await insertAs(ADMIN, RUN)).toBe("");
    expect(await visibleTo(ADMIN)).toBe(2);
  });

  it("AC-DOCAI-08: вендор і виконавець, що не є менеджером запуску, не бачать і не зберігають значень", async () => {
    expect(await visibleTo(VENDOR)).toBe(0);
    expect(await visibleTo(MANAGER_B)).toBe(0);
    expect(await insertAs(VENDOR, RUN)).toMatch(/row-level security/);
    expect(await insertAs(MANAGER_B, RUN)).toMatch(/row-level security/);
  });

  it("AC-DOCAI-08: відвідувач без входу не має доступу до таблиці", async () => {
    const denied = await t
      .asAnon("select id from public.run_document_values")
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(denied).toMatch(/permission denied/);
  });

  it("AC-DOCAI-08: confirmed_by не підробити — колонкового права на неї немає", async () => {
    expect(await insertAs(MANAGER_A, RUN, ADMIN)).toMatch(/permission denied/);
  });

  it("AC-DOCAI-08: підтверджений запис незмінний — ні update, ні delete", async () => {
    const update = await t
      .asUser(MANAGER_A, "update public.run_document_values set kind = 'estimate' where run_id = $1", [RUN])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    const remove = await t
      .asUser(ADMIN, "delete from public.run_document_values where run_id = $1", [RUN])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(update).toMatch(/permission denied/);
    expect(remove).toMatch(/permission denied/);
    expect(await visibleTo(ADMIN)).toBe(2);
  });

  it("AC-DOCAI-08: лише тип «request» чи «estimate» і значення-об'єкт", async () => {
    const badKind = await t
      .asUser(MANAGER_A, "insert into public.run_document_values (run_id, kind, fields) values ($1, 'invoice', '{}')", [RUN])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    const badFields = await t
      .asUser(MANAGER_A, "insert into public.run_document_values (run_id, kind, fields) values ($1, 'request', '[]')", [RUN])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(badKind).toMatch(/run_document_values_kind_check/);
    expect(badFields).toMatch(/run_document_values_fields_check/);
  });
});
