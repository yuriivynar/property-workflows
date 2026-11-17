// Ліміт запитів до моделі, розмір підтверджених значень і синхронізація email — правила бази на справжньому Postgres
// (PGlite) з усіма міграціями: supabase/migrations/20261117092135_ai_requests_limits_and_profile_email_sync.sql.
// Межа емуляції: PGlite — одне з'єднання, тож справжньої паралельності тут немає; атомарність забезпечує advisory
// lock у private.take_ai_request() (його поведінку під навантаженням цей тест не доводить — лише межі й права).
// Мутанти правил — Q13a–e, S05, S08a–b у scripts/mutants.mjs.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string, VENDOR: string;
let RUN: string;

const take = (userId: string) =>
  t.asUser<{ verdict: string }>(userId, "select public.take_ai_request() as verdict").then((rows) => rows[0].verdict);
const rowsOf = async (userId: string) =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.ai_requests where user_id = $1", [userId]))[0].n);
const message = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  VENDOR = t.users["vendor@example.test"];
  const [first] = await t.asService<{ id: string }>(
    `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
     where tt.template_id = $1 order by s.position, tt.position limit 1`,
    ["10000000-0000-4000-8000-000000000001"],
  );
  const [row] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, $3) as id", [
    "10000000-0000-4000-8000-000000000001",
    "Apartment 12, ai requests",
    { [first.id]: VENDOR },
  ]);
  RUN = row.id;
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

beforeEach(async () => {
  await t.asService("delete from public.ai_requests");
});

describe("take_ai_request: ліміт запитів до моделі", () => {
  it("AC-DOCAI-13: користувач отримує 10 запитів на годину, одинадцятий — «user_limit»", async () => {
    for (let i = 0; i < 10; i++) expect(await take(MANAGER_A)).toBe("allowed");
    expect(await take(MANAGER_A)).toBe("user_limit");
    expect(await rowsOf(MANAGER_A)).toBe(10);
  });

  it("AC-DOCAI-13: вичерпаний ліміт одного користувача не блокує інших", async () => {
    for (let i = 0; i < 11; i++) await take(MANAGER_A);
    expect(await take(MANAGER_B)).toBe("allowed");
    expect(await take(ADMIN)).toBe("allowed");
  });

  it("AC-DOCAI-13: запити, старші за годину, не рахуються до ліміту користувача", async () => {
    await t.asService(
      "insert into public.ai_requests (user_id, created_at) select $1, now() - interval '2 hours' from generate_series(1, 10)",
      [MANAGER_A],
    );
    expect(await take(MANAGER_A)).toBe("allowed");
  });

  it("AC-DOCAI-13: 40 запитів застосунку за добу вичерпують ліміт для всіх, «app_limit»", async () => {
    // 40 запитів різних людей дві години тому: годинний ліміт нікого не зачіпає, добовий — зачіпає всіх.
    await t.asService(
      `insert into public.ai_requests (user_id, created_at)
       select $1, now() - interval '2 hours' from generate_series(1, 20)`,
      [MANAGER_B],
    );
    await t.asService(
      `insert into public.ai_requests (user_id, created_at)
       select $1, now() - interval '3 hours' from generate_series(1, 20)`,
      [ADMIN],
    );
    expect(await take(MANAGER_A)).toBe("app_limit");
    expect(await rowsOf(MANAGER_A)).toBe(0);
  });

  it("AC-DOCAI-13: 39 запитів застосунку — ще є місце, сороковий дозволено, сорок перший — ні", async () => {
    await t.asService(
      `insert into public.ai_requests (user_id, created_at)
       select $1, now() - interval '2 hours' from generate_series(1, 39)`,
      [MANAGER_B],
    );
    expect(await take(MANAGER_A)).toBe("allowed");
    expect(await take(ADMIN)).toBe("app_limit");
  });

  it("AC-DOCAI-13: рядки старші за добу не рахуються й видаляються самою функцією", async () => {
    await t.asService(
      `insert into public.ai_requests (user_id, created_at)
       select $1, now() - interval '25 hours' from generate_series(1, 50)`,
      [MANAGER_B],
    );
    expect(await take(MANAGER_A)).toBe("allowed");
    const [row] = await t.asService<{ n: string }>("select count(*) as n from public.ai_requests");
    expect(Number(row.n)).toBe(1);
  });

  it("AC-DOCAI-16: вендор не отримує запиту до моделі, рядок не пишеться", async () => {
    expect(await take(VENDOR)).toBe("not_allowed");
    expect(await rowsOf(VENDOR)).toBe(0);
  });

  it("AC-DOCAI-16: відвідувач без входу не може викликати функцію", async () => {
    expect(await message(t.asAnon("select public.take_ai_request()"))).toMatch(/permission denied/);
    expect(await message(t.asAnon("select private.take_ai_request()"))).toMatch(/permission denied/);
  });

  it("AC-DOCAI-13: таблицю обліку клієнт не читає й не пише — лише функція", async () => {
    await take(MANAGER_A);
    expect(await message(t.asUser(MANAGER_A, "select * from public.ai_requests"))).toMatch(/permission denied/);
    expect(await message(t.asUser(MANAGER_A, "insert into public.ai_requests (user_id) values ($1)", [MANAGER_A]))).toMatch(
      /permission denied/,
    );
    expect(await message(t.asUser(ADMIN, "delete from public.ai_requests"))).toMatch(/permission denied/);
  });
});

describe("run_document_values.fields: обмеження розміру", () => {
  const insert = (fields: unknown) =>
    message(
      t.asUser(MANAGER_A, "insert into public.run_document_values (run_id, kind, fields) values ($1, 'estimate', $2)", [
        RUN,
        fields,
      ]),
    );

  it("найбільший кошторис, який пропускає форма (50 позицій по 200 символів, 7 приміток), зберігається", async () => {
    const fields = {
      items: Array.from({ length: 50 }, (_, i) => ({ name: `${i}`.padEnd(200, "x"), quantity: 1_000_000, unitPrice: 99_999_999.99 })),
      total: 100_000_000,
      notes: Array.from({ length: 7 }, () => "n".repeat(200)),
      warning: "items add up to 4999999999.50, the stated total is 100000000.00",
    };
    expect(await insert(fields)).toBe("");
  });

  it("той самий кошторис кирилицею (26 578 байт) теж зберігається", async () => {
    const fields = {
      items: Array.from({ length: 50 }, (_, i) => ({ name: `${i}`.padEnd(200, "ж"), quantity: 1_000_000, unitPrice: 99_999_999.99 })),
      total: 100_000_000,
      notes: Array.from({ length: 7 }, () => "ж".repeat(200)),
      warning: "w".repeat(70),
    };
    expect(await insert(fields)).toBe("");
  });

  it("значення понад 32 КБ база відхиляє, хоч би що надіслав прямий запит", async () => {
    expect(await insert({ notes: ["x".repeat(40_000)] })).toMatch(/run_document_values_fields_size_check/);
  });
});

describe("profiles.email слідом за auth.users.email", () => {
  const emailOf = async (userId: string) =>
    (await t.asService<{ email: string }>("select email from public.profiles where id = $1", [userId]))[0].email;

  it("зміна email у Auth оновлює email профілю цього користувача й нікого іншого", async () => {
    const before = await emailOf(MANAGER_B);
    await t.db.query("update auth.users set email = $2 where id = $1", [MANAGER_A, "manager.a.new@example.test"]);
    expect(await emailOf(MANAGER_A)).toBe("manager.a.new@example.test");
    expect(await emailOf(MANAGER_B)).toBe(before);
  });

  it("зміна іншого поля в Auth не чіпає профіль", async () => {
    await t.asService("update public.profiles set email = 'stale@example.test' where id = $1", [ADMIN]);
    await t.db.query("update auth.users set raw_user_meta_data = '{\"full_name\": \"Renamed\"}' where id = $1", [ADMIN]);
    expect(await emailOf(ADMIN)).toBe("stale@example.test");
  });

  it("клієнти не викликають функцію тригера напряму", async () => {
    expect(await message(t.asUser(ADMIN, "select private.sync_profile_email()"))).toMatch(/permission denied/);
  });
});
