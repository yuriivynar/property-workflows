// Роль за замовчуванням — найменші права (порада викладача WS7–WS9; рішення власника 2026-11-27; поза вимогами PM —
// без AC ID): профіль, якому роль не призначили явно, — «vendor», а не «manager». Такий акаунт не бачить колег і не
// запускає шаблонів. Міграція 20261126224855_least_privilege_defaults_and_document_fields.sql на PGlite.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
const NEW_USER = "b0000000-0000-4000-8000-000000000001";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
  // Новий акаунт, як після реєстрації: тригер on_auth_user_created створює профіль без явної ролі.
  await t.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}')", [
    NEW_USER,
    "new.user@example.test",
  ]);
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("Новий акаунт без призначеної ролі", () => {
  it("отримує роль vendor", async () => {
    const [profile] = await t.asService<{ role: string }>("select role from public.profiles where id = $1", [NEW_USER]);
    expect(profile.role).toBe("vendor");
  });

  it("не бачить колег і не запускає шаблонів", async () => {
    expect(await t.asUser(NEW_USER, "select * from public.staff_directory()")).toEqual([]);
    const launch = await t
      .asUser(NEW_USER, "select public.launch_run($1, 'Apartment 99, new account', '{}'::jsonb)", [TENANT_MOVE_IN])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(launch).toMatch(/LAUNCH_NOT_ALLOWED|NOT_ALLOWED|permission denied/);
  });
});
