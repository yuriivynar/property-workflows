// Журнал подій запуску й фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID):
// тригери пишуть «хто, що, коли», підробити подію напряму не можна, вендор не бачить чужої стрічки, avatar_url — лише
// своя тека. Міграція 20261126111059_activity_live_avatars.sql на PGlite з усіма міграціями.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
const REPAIR = "10000000-0000-4000-8000-000000000003";

let t: TestDb;
let MANAGER_A: string, MANAGER_B: string, VENDOR: string;

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

async function launch(userId: string, templateId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    templateId,
    caseName,
    assignments,
  ]);
  return row.id;
}

const events = (userId: string, runId: string) =>
  t.asUser<{ kind: string; actor_id: string | null; task_id: string | null; answer: string | null }>(
    userId,
    "select kind, actor_id, task_id, answer from public.run_events where run_id = $1 order by id",
    [runId],
  );

beforeAll(async () => {
  t = await createTestDb();
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  VENDOR = t.users["vendor@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: журнал подій запуску", () => {
  it("запуск, позначка задачі й відповідь на поле — події з автором; повторна позначка не дублює подію", async () => {
    const runId = await launch(MANAGER_A, REPAIR, "Apartment 7, events");
    const [field] = await t.asService<{ id: string }>("select id from public.run_fields where run_id = $1", [runId]);
    await t.asUser(MANAGER_A, "select public.set_run_field_answer($1, $2)", [field.id, "urgent"]);
    const [task] = await t.asService<{ id: string }>(
      "select id from public.run_tasks where run_id = $1 and name = 'Inspect the leak'",
      [runId],
    );
    await t.asUser(MANAGER_A, "select public.mark_task_done($1, true)", [task.id]);
    await t.asUser(MANAGER_A, "select public.mark_task_done($1, true)", [task.id]);

    expect(await events(MANAGER_A, runId)).toEqual([
      { kind: "launched", actor_id: MANAGER_A, task_id: null, answer: null },
      { kind: "answer_set", actor_id: MANAGER_A, task_id: null, answer: "urgent" },
      { kind: "task_done", actor_id: MANAGER_A, task_id: task.id, answer: null },
    ]);
  });

  it("подію не підробити прямим запитом: insert у run_events заборонено", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "Apartment 12, forged");
    expect(
      await errorOf(t.asUser(MANAGER_A, "insert into public.run_events (run_id, kind) values ($1, 'launched')", [runId])),
    ).toContain("permission denied");
    expect(await errorOf(t.asUser(MANAGER_A, "select private.log_run_launched()"))).not.toBe("");
  });

  it("сторонній менеджер не бачить стрічки; вендор бачить лише власні позначки", async () => {
    const [first] = await t.asService<{ id: string }>(
      `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
       where tt.template_id = $1 order by s.position, tt.position limit 1`,
      [TENANT_MOVE_IN],
    );
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "Apartment 12, vendor feed", { [first.id]: VENDOR });
    const [vendorTask] = await t.asService<{ id: string }>(
      "select id from public.run_tasks where run_id = $1 and assignee_id = $2",
      [runId, VENDOR],
    );
    await t.asUser(VENDOR, "select public.mark_task_done($1, true)", [vendorTask.id]);

    expect(await events(MANAGER_B, runId)).toEqual([]);
    expect((await events(VENDOR, runId)).map((event) => event.kind)).toEqual(["task_done"]);
    expect((await events(MANAGER_A, runId)).map((event) => event.kind)).toEqual(["launched", "task_done"]);
  });
});

describe("База: фото профілю — лише своя тека", () => {
  it("свій avatar_url у своїй теці — можна; чужа тека — check; чужий профіль — не змінюється (RLS)", async () => {
    await t.asUser(MANAGER_A, "update public.profiles set avatar_url = $1 where id = $2", [`${MANAGER_A}/avatar-1.png`, MANAGER_A]);
    const [own] = await t.asService<{ avatar_url: string }>("select avatar_url from public.profiles where id = $1", [MANAGER_A]);
    expect(own.avatar_url).toBe(`${MANAGER_A}/avatar-1.png`);

    expect(
      await errorOf(
        t.asUser(MANAGER_A, "update public.profiles set avatar_url = $1 where id = $2", [`${MANAGER_B}/x.png`, MANAGER_A]),
      ),
    ).toContain("profiles_avatar_url_own_folder");

    await t.asUser(MANAGER_A, "update public.profiles set avatar_url = $1 where id = $2", [`${MANAGER_B}/x.png`, MANAGER_B]);
    const [other] = await t.asService<{ avatar_url: string | null }>("select avatar_url from public.profiles where id = $1", [MANAGER_B]);
    expect(other.avatar_url).toBeNull();
  });

  it("роль змінити не можна: колонковий grant лише full_name і avatar_url", async () => {
    expect(
      await errorOf(t.asUser(MANAGER_A, "update public.profiles set role = 'admin' where id = $1", [MANAGER_A])),
    ).toContain("permission denied");
  });
});
