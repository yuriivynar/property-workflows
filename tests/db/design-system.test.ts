// Однакові стани сторінок на рівні бази: відвідувач без входу не отримує даних запуску, менеджер без запусків
// отримує порожній список (PGlite з усіма міграціями). Покриває AC-DSYS-03, AC-DSYS-04 у docs/conformance.md.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: стани сторінок", () => {
  it("AC-DSYS-03: відвідувач без входу не читає жодних даних запуску", async () => {
    const manager = t.users["manager.a@example.test"];
    const [{ id }] = await t.asUser<{ id: string }>(manager, "select public.launch_run($1, 'Apartment 30', '{}') as id", [
      TENANT_MOVE_IN,
    ]);
    for (const sql of [
      "select id from public.runs where id = $1",
      "select id from public.run_tasks where run_id = $1",
      "select id from public.run_sections where run_id = $1",
    ]) {
      await expect(t.asAnon(sql, [id])).rejects.toThrow(/permission denied/);
    }
    await expect(t.asAnon("select * from public.run_overview where id = $1", [id])).rejects.toThrow(/permission denied/);
    // Запуск існує й не змінився.
    const [run] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [id]);
    expect(run.status).toBe("in_progress");
  });

  it("AC-DSYS-04: менеджер B без запусків отримує порожній список (сторінка покаже порожній стан)", async () => {
    const managerB = t.users["pm-manager@example.test"]; // жодного запуску й жодної задачі
    const runs = await t.asUser(managerB, "select id from public.run_overview");
    expect(runs).toHaveLength(0);
  });
});
