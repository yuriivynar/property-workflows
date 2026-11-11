// Вендор — виконавець задач (зріз 3, openspec/specs/vendor-work): правила, які виконує база — роль vendor, RLS шаблонів
// і запусків, staff_directory, launch_run, mark_task_done, vendor_runs і vendor_run_tasks (міграція vendor_role), — на
// справжньому Postgres (PGlite) з усіма міграціями. Покривають AC-VENDOR-* у docs/conformance.md.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
const REPAIR_REQUEST = "10000000-0000-4000-8000-000000000002";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string, VENDOR_V: string, VENDOR_EMPTY: string;

interface TaskRow {
  id: string;
  name: string;
  status: string;
  assignee_id: string;
  is_required: boolean;
}

/** Задачі шаблону в порядку розділів і позицій: 1 Sign the lease … 5 Record meter readings (AC-RUN-01). */
const templateTaskIds = async (templateId: string) =>
  (
    await t.asService<{ id: string }>(
      `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
       where tt.template_id = $1 order by s.position, tt.position`,
      [templateId],
    )
  ).map((r) => r.id);

async function launch(userId: string, templateId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    templateId,
    caseName,
    assignments,
  ]);
  return row.id;
}

/** Задачі запуску в обхід RLS, у порядку шаблону — для підготовки й перевірки результату. */
const tasksOf = (runId: string) =>
  t.asService<TaskRow>(
    `select t.id, t.name, t.status, t.assignee_id, t.is_required
     from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
     where t.run_id = $1 order by s.position, t.position`,
    [runId],
  );

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

/** «Apartment 12, move-in»: менеджер A запускає «Tenant move-in», задачі 3 і 4 — вендору V (AC-VENDOR-01). */
async function apartment12(caseName = "Apartment 12, move-in") {
  const ids = await templateTaskIds(TENANT_MOVE_IN);
  const runId = await launch(MANAGER_A, TENANT_MOVE_IN, caseName, { [ids[2]]: VENDOR_V, [ids[3]]: VENDOR_V });
  return { runId, tasks: await tasksOf(runId) };
}

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  VENDOR_V = t.users["vendor@example.test"];
  VENDOR_EMPTY = t.users["pm-vendor@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: менеджер призначає вендора", () => {
  it("AC-VENDOR-01: менеджер A призначає вендора V виконавцем задач 3 і 4 — задачі 1, 2 і 5 лишаються за A", async () => {
    const { tasks } = await apartment12("AC-VENDOR-01 Apartment 12, move-in");

    expect(tasks).toHaveLength(5);
    expect(tasks.map((task) => task.assignee_id)).toEqual([MANAGER_A, MANAGER_A, VENDOR_V, VENDOR_V, MANAGER_A]);
  });

  it("AC-VENDOR-02: у виборі виконавця менеджер A бачить email менеджера B, адміністратора й вендора V — лише email", async () => {
    const staff = await t.asUser<Record<string, unknown>>(MANAGER_A, "select * from public.staff_directory()");

    const emails = staff.map((person) => person.email);
    expect(emails).toEqual(expect.arrayContaining(["manager.b@example.test", "admin@example.test", "vendor@example.test"]));
    // Жодних імен, ролей чи інших даних профілю: лише id (значення вибору) і email.
    for (const person of staff) expect(Object.keys(person).sort()).toEqual(["email", "id"]);
  });
});

describe("База: що бачить вендор", () => {
  it("AC-VENDOR-03: вендор V бачить лише запуск зі своїми 2 задачами — статус і «Your tasks: 0 of 2 done», без чужого", async () => {
    const { runId } = await apartment12("AC-VENDOR-03 Apartment 12, move-in");
    const repairId = await launch(MANAGER_A, REPAIR_REQUEST, "AC-VENDOR-03 Apartment 14, repair");

    const runs = await t.asUser<{ id: string; case_name: string; status: string; my_done: number; my_total: number }>(
      VENDOR_V,
      "select id, case_name, status, my_done, my_total from public.vendor_runs()",
    );
    const mine = runs.find((run) => run.id === runId);
    expect(mine).toMatchObject({ case_name: "AC-VENDOR-03 Apartment 12, move-in", status: "in_progress", my_done: 0, my_total: 2 });
    expect(runs.some((run) => run.id === repairId)).toBe(false);
    // Рядків запусків (назва шаблону, версія, менеджер запуску, прогрес усього запуску) вендор напряму не читає.
    expect(await t.asUser(VENDOR_V, "select id from public.runs where id = $1", [runId])).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.run_overview where id = $1", [runId])).toEqual([]);
  });

  it("AC-VENDOR-04: вендор V бачить рівно задачі 3 і 4 — назва, розділ, обов'язковість і статус; без чужих задач і email", async () => {
    const { runId, tasks } = await apartment12("AC-VENDOR-04 Apartment 12, move-in");

    const visible = await t.asUser<{ id: string }>(VENDOR_V, "select id from public.run_tasks where run_id = $1", [runId]);
    expect(visible.map((task) => task.id).sort()).toEqual([tasks[2].id, tasks[3].id].sort());

    const own = await t.asUser<{ name: string; section_name: string; is_required: boolean; status: string }>(
      VENDOR_V,
      "select name, section_name, is_required, status from public.vendor_run_tasks($1)",
      [runId],
    );
    expect(own).toEqual([
      { name: "Order cleaning", section_name: "Before move-in", is_required: false, status: "to_do" },
      { name: "Hand over the keys", section_name: "Move-in day", is_required: true, status: "to_do" },
    ]);
    // Email інших користувачів вендор не отримує.
    expect(await t.asUser(VENDOR_V, "select * from public.staff_directory()")).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.profiles where id <> $1", [VENDOR_V])).toEqual([]);
  });

  it("AC-VENDOR-04: розділ без задач вендора йому не видно", async () => {
    const ids = await templateTaskIds(TENANT_MOVE_IN);
    // Лише задача 4 («Move-in day») — розділу «Before move-in» вендор не бачить.
    const runId = await launch(MANAGER_A, TENANT_MOVE_IN, "AC-VENDOR-04 one section", { [ids[3]]: VENDOR_V });

    const sections = await t.asUser<{ name: string }>(VENDOR_V, "select name from public.run_sections where run_id = $1", [
      runId,
    ]);
    expect(sections.map((section) => section.name)).toEqual(["Move-in day"]);
  });

  it("AC-VENDOR-06: запуск, де вендор не має задач, за прямим посиланням — жодної задачі й жодного рядка запуску", async () => {
    const repairId = await launch(MANAGER_A, REPAIR_REQUEST, "AC-VENDOR-06 Apartment 14, repair");

    expect(await t.asUser(VENDOR_V, "select id from public.vendor_run_tasks($1)", [repairId])).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.run_tasks where run_id = $1", [repairId])).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.run_sections where run_id = $1", [repairId])).toEqual([]);
    const runs = await t.asUser<{ id: string }>(VENDOR_V, "select id from public.vendor_runs()");
    expect(runs.some((run) => run.id === repairId)).toBe(false);
  });

  it("AC-VENDOR-10: вендор без призначених задач — список його запусків порожній", async () => {
    await apartment12("AC-VENDOR-10 Apartment 12, move-in");

    expect(await t.asUser(VENDOR_EMPTY, "select id from public.vendor_runs()")).toEqual([]);
  });
});

describe("База: заголовок запуску й рядок списку вендора", () => {
  const TEMPLATE_NAME = "Tenant move-in";
  const contains = (rows: Record<string, unknown>[], text: string) =>
    rows.some((row) => Object.values(row).some((value) => typeof value === "string" && value.includes(text)));

  it("AC-VENDOR-11: вендор отримує для сторінки запуску назву випадку й «Your tasks: 1 of 2 done» — без статусу запуску в задачах, назви й версії шаблону", async () => {
    const { runId, tasks } = await apartment12("AC-VENDOR-11 Apartment 12, move-in");
    const own = tasks.filter((task) => task.assignee_id === VENDOR_V);
    expect(own).toHaveLength(2);
    // Задача 3 — «done», задача 4 — «to do», як у «Дано».
    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, true)", [own[0].id]))).toBe("");

    const [run] = await t.asUser<Record<string, unknown>>(VENDOR_V, "select * from public.vendor_runs() where id = $1", [runId]);
    expect(run).toMatchObject({ case_name: "AC-VENDOR-11 Apartment 12, move-in", my_done: 1, my_total: 2 });
    expect(Object.keys(run).sort()).toEqual(["case_name", "created_at", "id", "my_done", "my_total", "status"]);
    const runTasks = await t.asUser<Record<string, unknown>>(VENDOR_V, "select * from public.vendor_run_tasks($1)", [runId]);
    expect(runTasks).toHaveLength(2);
    for (const row of runTasks) {
      expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["template_name"]));
      expect(Object.keys(row)).not.toEqual(expect.arrayContaining(["template_version"]));
    }
    expect(contains([run, ...runTasks], TEMPLATE_NAME)).toBe(false);
    // Рядки runs і run_overview (там назва й версія шаблону, статус і прогрес усього запуску) вендору закрито.
    expect(await t.asUser(VENDOR_V, "select template_name, template_version from public.runs where id = $1", [runId])).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select * from public.run_overview where id = $1", [runId])).toEqual([]);
  });

  it("AC-VENDOR-12: рядок списку запусків вендора — назва випадку, статус запуску й «Your tasks: 0 of 2 done», без назви шаблону «Tenant move-in»", async () => {
    const { runId } = await apartment12("AC-VENDOR-12 Apartment 12, move-in");

    const rows = await t.asUser<Record<string, unknown>>(VENDOR_V, "select * from public.vendor_runs()");
    const row = rows.find((candidate) => candidate.id === runId);
    expect(row).toMatchObject({ case_name: "AC-VENDOR-12 Apartment 12, move-in", status: "in_progress", my_done: 0, my_total: 2 });
    expect(Object.keys(row!).sort()).toEqual(["case_name", "created_at", "id", "my_done", "my_total", "status"]);
    expect(contains(rows, TEMPLATE_NAME)).toBe(false);
  });
});

describe("База: позначка задач вендором", () => {
  it("AC-VENDOR-05: вендор V позначає свою задачу 3 (не остання обов'язкова) — «done» і «Your tasks: 1 of 2 done»", async () => {
    const { runId, tasks } = await apartment12("AC-VENDOR-05 Apartment 12, move-in");

    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, false)", [tasks[2].id]))).toBe("");

    const [task] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [tasks[2].id]);
    expect(task.status).toBe("done");
    const [mine] = await t.asUser<{ my_done: number; my_total: number }>(
      VENDOR_V,
      "select my_done, my_total from public.vendor_runs() where id = $1",
      [runId],
    );
    expect(mine).toEqual({ my_done: 1, my_total: 2 });
  });

  it("AC-VENDOR-05: остання обов'язкова задача й для вендора — лише з підтвердженням «This cannot be undone»", async () => {
    const { runId, tasks } = await apartment12("AC-VENDOR-05 last required");
    // Обов'язкові 1 і 2 (менеджера A) уже «done» — лишилась обов'язкова задача 4 вендора.
    for (const task of [tasks[0], tasks[1]]) await t.asUser(MANAGER_A, "select public.mark_task_done($1, false)", [task.id]);

    const own = await t.asUser<{ name: string; needs_confirmation: boolean }>(
      VENDOR_V,
      "select name, needs_confirmation from public.vendor_run_tasks($1)",
      [runId],
    );
    expect(own).toEqual([
      { name: "Order cleaning", needs_confirmation: false },
      { name: "Hand over the keys", needs_confirmation: true },
    ]);
    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, false)", [tasks[3].id]))).toMatch(
      /CONFIRMATION_REQUIRED/,
    );
    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, true)", [tasks[3].id]))).toBe("");
    const [run] = await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]);
    expect(run.status).toBe("completed");
  });

  it("AC-VENDOR-07: вендор V прямим запитом позначає задачу 1 менеджера A — відмова, задача лишається «to do»", async () => {
    const { tasks } = await apartment12("AC-VENDOR-07 Apartment 12, move-in");
    const taskOfA = tasks[0];

    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, true)", [taskOfA.id]))).toMatch(/NOT_ALLOWED/);
    expect(
      await errorOf(t.asUser(VENDOR_V, "update public.run_tasks set status = 'done' where id = $1", [taskOfA.id])),
    ).toMatch(/permission denied/);
    const [task] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [taskOfA.id]);
    expect(task.status).toBe("to_do");
  });
});

describe("База: задача запуску без задач вендора", () => {
  it("AC-VENDOR-15: вендор V прямим запитом позначає задачу 1 менеджера A в «Apartment 14, repair», де в нього немає задач — відмова, задача лишається «to do»", async () => {
    const repairId = await launch(MANAGER_A, REPAIR_REQUEST, "AC-VENDOR-15 Apartment 14, repair");
    const [taskOfA] = await t.asService<{ id: string }>(
      "select id from public.run_tasks where run_id = $1 and assignee_id = $2 order by position limit 1",
      [repairId, MANAGER_A],
    );

    expect(await errorOf(t.asUser(VENDOR_V, "select public.mark_task_done($1, true)", [taskOfA.id]))).toMatch(/NOT_ALLOWED/);
    expect(
      await errorOf(t.asUser(VENDOR_V, "update public.run_tasks set status = 'done' where id = $1", [taskOfA.id])),
    ).toMatch(/permission denied/);
    const [task] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [taskOfA.id]);
    expect(task.status).toBe("to_do");
    // Сторінка показує «Run not found»: запуску немає серед vendor_runs() вендора (vendorRunNotice без тексту відмови).
    const runs = await t.asUser<{ id: string }>(VENDOR_V, "select id from public.vendor_runs()");
    expect(runs.some((run) => run.id === repairId)).toBe(false);
  });
});

describe("База: колишній менеджер запуску з роллю vendor", () => {
  it("AC-VENDOR-07: менеджер запуску, якому змінили роль на vendor, не позначає чужу задачу свого колишнього запуску", async () => {
    // Рецензія CodeRabbit (CWE-863): право менеджера запуску — лише за поточної ролі manager (solomchaak/property-workflows-spec#45).
    const MANAGER_C = t.users["manager.c@example.test"];
    const ids = await templateTaskIds(TENANT_MOVE_IN);
    const runId = await launch(MANAGER_C, TENANT_MOVE_IN, "AC-VENDOR-07 former manager", { [ids[0]]: MANAGER_B });
    const [taskOfB] = (await tasksOf(runId)).filter((task) => task.assignee_id === MANAGER_B);

    await t.asService("update public.profiles set role = 'vendor' where id = $1", [MANAGER_C]);
    try {
      expect(await errorOf(t.asUser(MANAGER_C, "select public.mark_task_done($1, true)", [taskOfB.id]))).toMatch(
        /NOT_ALLOWED/,
      );
      const [task] = await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [taskOfB.id]);
      expect(task.status).toBe("to_do");
      // Свою задачу (як виконавець) він, як і будь-який вендор, позначає.
      const [own] = (await tasksOf(runId)).filter((task) => task.assignee_id === MANAGER_C && !task.is_required);
      expect(await errorOf(t.asUser(MANAGER_C, "select public.mark_task_done($1, false)", [own.id]))).toBe("");
    } finally {
      await t.asService("update public.profiles set role = 'manager' where id = $1", [MANAGER_C]);
    }
  });
});

describe("База: шаблони й запуск для вендора", () => {
  it("AC-VENDOR-08: вендор V не читає жодного шаблону, розділу, задачі шаблону чи версії", async () => {
    expect(await t.asUser(VENDOR_V, "select id from public.templates")).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.template_sections")).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.template_tasks")).toEqual([]);
    expect(await t.asUser(VENDOR_V, "select id from public.template_versions")).toEqual([]);
    // Менеджер, як і раніше, бачить збережені шаблони (AC-EDITOR-02).
    const managerSees = await t.asUser<{ id: string }>(MANAGER_B, "select id from public.templates where id = $1", [
      TENANT_MOVE_IN,
    ]);
    expect(managerSees).toHaveLength(1);
  });

  it("AC-VENDOR-09: вендор V прямим запитом запускає «Tenant move-in» (версія 1) — запуску немає, список запусків той самий", async () => {
    const [before] = await t.asService<{ n: number }>("select count(*)::int as n from public.runs");

    expect(await errorOf(launch(VENDOR_V, TENANT_MOVE_IN, "AC-VENDOR-09 Apartment 12, move-in"))).toMatch(
      /LAUNCH_NOT_ALLOWED/,
    );
    const [after] = await t.asService<{ n: number }>("select count(*)::int as n from public.runs");
    expect(after.n).toBe(before.n);
    // Адміністратор, як і раніше, бачить усі запуски, зокрема з задачами вендора.
    const adminSees = await t.asUser<{ n: number }>(ADMIN, "select count(*)::int as n from public.runs");
    expect(adminSees[0].n).toBe(after.n);
  });
});
