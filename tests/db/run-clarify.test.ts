// Уточнення після відповідей PM (зміна clarify-workflow-runs): правила бази для AC-RUN-10…12 і AC-TASK-10…17
// на справжньому Postgres (PGlite) з усіма міграціями.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatProgress } from "../../src/lib/runs/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
const REPAIR_REQUEST = "10000000-0000-4000-8000-000000000002";

let t: TestDb;
let MANAGER_A: string, MANAGER_B: string, MANAGER_C: string;

async function launch(userId: string, template: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    template,
    caseName,
    assignments,
  ]);
  return row.id;
}

const mark = (userId: string, taskId: string) => t.asUser(userId, "select public.mark_task_done($1, true)", [taskId]);

const tasksOf = (runId: string) =>
  t.asService<{ id: string; is_required: boolean; assignee_id: string; section: string; status: string }>(
    `select t.id, t.is_required, t.assignee_id, s.name as section, t.status
     from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
     where t.run_id = $1 order by s.position, t.position`,
    [runId],
  );

/** Шаблон з розділами «Before move-in» (2 задачі) і «Move-in day» (3 задачі), як у AC-RUN-12 і AC-TASK-12. */
async function templateTwoThree(prefix: string) {
  const template = `${prefix}-0000-4000-8000-000000000001`;
  const before = `${prefix}-0000-4000-8000-000000000011`;
  const moveIn = `${prefix}-0000-4000-8000-000000000012`;
  await t.asService("insert into public.templates (id, name) values ($1, $2)", [template, `Two-three ${prefix}`]);
  await t.asService(
    "insert into public.template_sections (id, template_id, name, position) values ($1, $3, 'Before move-in', 1), ($2, $3, 'Move-in day', 2)",
    [before, moveIn, template],
  );
  await t.asService(
    `insert into public.template_tasks (template_id, section_id, name, is_required, position) values
       ($1, $2, 'Sign the lease', true, 1), ($1, $2, 'Collect the deposit', true, 2),
       ($1, $3, 'Hand over the keys', true, 1), ($1, $3, 'Record meter readings', false, 2), ($1, $3, 'Order cleaning', false, 3)`,
    [template, before, moveIn],
  );
  return { template, before, moveIn };
}

beforeAll(async () => {
  t = await createTestDb();
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  MANAGER_C = t.users["manager.c@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: запуск — уточнення PM", () => {
  it("AC-RUN-10: у виборі виконавця менеджер A бачить email менеджера B і адміністратора — без імен і ролей", async () => {
    const rows = await t.asUser<Record<string, unknown>>(MANAGER_A, "select * from public.staff_directory()");

    expect(Object.keys(rows[0]).sort()).toEqual(["email", "id"]);
    const emails = rows.map((r) => r.email);
    expect(emails).toEqual(expect.arrayContaining(["manager.b@example.test", "admin@example.test"]));
    // Чужі профілі напряму, як і раніше, недоступні.
    expect(await t.asUser(MANAGER_A, "select id from public.profiles where id = $1", [MANAGER_B])).toHaveLength(0);
  });

  it("AC-RUN-11: назва зі 100 символів з пробілом попереду (101 як набрано) → один запуск, збережено 100 символів", async () => {
    const name = "N".repeat(100);
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, ` ${name}`);

    const [run] = await t.asService<{ case_name: string }>("select case_name from public.runs where id = $1", [runId]);
    expect(run.case_name).toBe(name);
    expect([...run.case_name]).toHaveLength(100);
  });

  it("AC-RUN-12: перейменування розділу й перенесення задачі в шаблоні не змінюють розділів запуску (2 і 3 задачі)", async () => {
    const { template, before, moveIn } = await templateTwoThree("a1b2c3d4");
    const runId = await launch(MANAGER_A, template, "Apartment 30, move-in");

    await t.asService("update public.template_sections set name = 'Key handover' where id = $1", [moveIn]);
    await t.asService(
      "update public.template_tasks set section_id = $1 where section_id = $2 and name = 'Hand over the keys'",
      [before, moveIn],
    );

    const tasks = await t.asUser<{ section: string }>(
      MANAGER_A,
      `select s.name as section from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
       where t.run_id = $1 order by s.position, t.position`,
      [runId],
    );
    expect(tasks.filter((r) => r.section === "Before move-in")).toHaveLength(2);
    expect(tasks.filter((r) => r.section === "Move-in day")).toHaveLength(3);
    expect(tasks.some((r) => r.section === "Key handover")).toBe(false);
  });
});

describe("База: запуск і задачі — уточнення PM", () => {
  it("AC-TASK-10: менеджер C, що не має стосунку до запуску, не отримує ні запуску, ні жодної задачі", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-10 run");

    expect(await t.asUser(MANAGER_C, "select id from public.run_overview where id = $1", [runId])).toHaveLength(0);
    expect(await t.asUser(MANAGER_C, "select id from public.run_tasks where run_id = $1", [runId])).toHaveLength(0);
    expect(await t.asUser(MANAGER_C, "select id from public.run_sections where run_id = $1", [runId])).toHaveLength(0);
  });

  it("AC-TASK-11: менеджер B бачить біля задач email виконавців — довідник віддає лише id і email", async () => {
    const [first] = (await t.asService<{ id: string }>(
      "select id from public.template_tasks where template_id = $1 order by position limit 1",
      [TENANT_MOVE_IN],
    )).map((r) => r.id);
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-11 run", { [first]: MANAGER_B });

    const tasks = await t.asUser<{ assignee_id: string }>(MANAGER_B, "select assignee_id from public.run_tasks where run_id = $1", [runId]);
    const directory = await t.asUser<Record<string, string>>(MANAGER_B, "select * from public.staff_directory()");
    const emailById = new Map(directory.map((p) => [p.id, p.email]));

    expect(tasks).toHaveLength(5);
    for (const task of tasks) expect(emailById.get(task.assignee_id)).toMatch(/@example\.test$/);
    expect(directory.every((p) => Object.keys(p).sort().join(",") === "email,id")).toBe(true);
  });

  it("AC-TASK-12: задачі запуску — двома групами в порядку розділів шаблону: «Before move-in» (2), «Move-in day» (3)", async () => {
    const { template } = await templateTwoThree("b1c2d3e4");
    const runId = await launch(MANAGER_A, template, "Apartment 31, move-in");

    const sections = (await tasksOf(runId)).map((r) => r.section);
    expect(sections).toEqual(["Before move-in", "Before move-in", "Move-in day", "Move-in day", "Move-in day"]);
  });

  it("AC-TASK-15: 3 задачі «required» і 2 «optional»", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-15 run");
    const flags = (await t.asUser<{ is_required: boolean }>(MANAGER_A, "select is_required from public.run_tasks where run_id = $1", [runId])).map(
      (r) => r.is_required,
    );

    expect(flags.filter(Boolean)).toHaveLength(3);
    expect(flags.filter((f) => !f)).toHaveLength(2);
  });

  it("AC-TASK-16: без підтвердження (скасування) остання обов'язкова задача лишається «to do», запуск — «in progress»", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-16 run");
    const required = (await tasksOf(runId)).filter((r) => r.is_required);
    await mark(MANAGER_A, required[0].id);
    await mark(MANAGER_A, required[1].id);

    // Позначка без підтвердження — так поводиться і застаріла сторінка, і скасоване підтвердження: база відмовляє.
    await expect(t.asUser(MANAGER_A, "select public.mark_task_done($1)", [required[2].id])).rejects.toThrow(
      /CONFIRMATION_REQUIRED/,
    );
    const [run] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
    const [last] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [required[2].id]);
    expect(run.status).toBe("in_progress");
    expect(last.status).toBe("to_do");
  });

  it("AC-TASK-04: остання обов'язкова задача з підтвердженням — запуск «completed»", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-04 confirmed");
    const required = (await tasksOf(runId)).filter((r) => r.is_required);
    for (const task of required) await mark(MANAGER_A, task.id);

    const [run] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
    expect(run.status).toBe("completed");
  });

  it("AC-TASK-01: задачу, що не є останньою обов'язковою, база позначає без підтвердження", async () => {
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-TASK-01 no confirm");
    const tasks = await tasksOf(runId);
    const firstRequired = tasks.find((r) => r.is_required)!;
    const optional = tasks.find((r) => !r.is_required)!;

    await t.asUser(MANAGER_A, "select public.mark_task_done($1)", [firstRequired.id]);
    await t.asUser(MANAGER_A, "select public.mark_task_done($1)", [optional.id]);
    const statuses = await t.asService<{ status: string }>("select status from public.run_tasks where id in ($1, $2)", [
      firstRequired.id,
      optional.id,
    ]);
    expect(statuses.every((r) => r.status === "done")).toBe(true);
  });
});

describe("База: список запусків — уточнення PM", () => {
  // Окрема база: у списку менеджера A мають бути лише запуски цих сценаріїв.
  let l: TestDb;
  beforeAll(async () => {
    l = await createTestDb();
  }, 60_000);
  afterAll(async () => {
    await l.db.close();
  });

  const launchIn = async (userId: string, template: string, caseName: string, assignments: Record<string, string> = {}) =>
    (await l.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [template, caseName, assignments]))[0].id;
  const tasksIn = (runId: string) =>
    l.asService<{ id: string; is_required: boolean }>(
      "select id, is_required from public.run_tasks where run_id = $1 order by position",
      [runId],
    );
  const markIn = (userId: string, taskId: string) => l.asUser(userId, "select public.mark_task_done($1, true)", [taskId]);

  it("AC-TASK-13: у списку і «completed» (4 of 5 done), і «in progress» запуск, кожен зі статусом і прогресом", async () => {
    const a = l.users["manager.a@example.test"];
    const done = await launchIn(a, TENANT_MOVE_IN, "Completed one");
    const tasks = await tasksIn(done);
    const optional = tasks.filter((x) => !x.is_required);
    for (const x of tasks) if (x.id !== optional[0].id) await markIn(a, x.id);
    const open = await launchIn(a, TENANT_MOVE_IN, "Open one");

    const list = await l.asUser<{ id: string; status: string; done_count: number; total_count: number }>(
      a,
      "select id, status, done_count, total_count from public.run_overview",
    );
    const completed = list.find((r) => r.id === done)!;
    const inProgress = list.find((r) => r.id === open)!;
    expect(completed.status).toBe("completed");
    expect(formatProgress(completed.done_count, completed.total_count)).toBe("4 of 5 done");
    expect(inProgress.status).toBe("in_progress");
  });

  it("AC-TASK-14: «Repair» запущено пізніше — у списку першим; у рядку назва випадку й шаблону", async () => {
    const a = l.users["manager.a@example.test"];
    const moveIn = await launchIn(a, TENANT_MOVE_IN, "Apartment 12");
    const repair = await launchIn(a, REPAIR_REQUEST, "Apartment 12");

    const list = await l.asUser<{ id: string; case_name: string; template_name: string }>(
      a,
      "select id, case_name, template_name from public.run_overview order by created_at desc",
    );
    const ids = list.map((r) => r.id);
    expect(ids.indexOf(repair)).toBeLessThan(ids.indexOf(moveIn));
    expect(list.find((r) => r.id === repair)).toMatchObject({ case_name: "Apartment 12", template_name: "Repair request" });
    expect(list.find((r) => r.id === moveIn)).toMatchObject({ case_name: "Apartment 12", template_name: "Tenant move-in" });
  });

  it("AC-TASK-17: виконавець B бачить у списку запуск менеджера A з прогресом «2 of 5 done»", async () => {
    const a = l.users["manager.a@example.test"];
    const b = l.users["manager.b@example.test"];
    const [first] = (await l.asService<{ id: string }>(
      "select id from public.template_tasks where template_id = $1 order by position limit 1",
      [TENANT_MOVE_IN],
    )).map((r) => r.id);
    const runId = await launchIn(a, TENANT_MOVE_IN, "Progress for B", { [first]: b });
    const tasks = await tasksIn(runId);
    await markIn(a, tasks[0].id);
    await markIn(a, tasks[1].id);

    const [row] = await l.asUser<{ done_count: number; total_count: number }>(
      b,
      "select done_count, total_count from public.run_overview where id = $1",
      [runId],
    );
    expect(formatProgress(row.done_count, row.total_count)).toBe("2 of 5 done");
  });
});
