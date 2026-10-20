// Позначка задач, завершення запуску, прогрес і видимість — правила, які виконує база (mark_task_done, run_overview,
// RLS), на справжньому Postgres (PGlite) з усіма міграціями. Покривають AC-TASK-* у docs/conformance.md
// (специфікація openspec/specs/run-progress).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatProgress } from "../../src/lib/runs/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string, MANAGER_C: string;

interface TaskRow {
  id: string;
  name: string;
  status: string;
  assignee_id: string;
  is_required: boolean;
}

async function launch(userId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    TENANT_MOVE_IN,
    caseName,
    assignments,
  ]);
  return row.id;
}

/** Позначка так, як її робить server action markTaskDone: supabase.rpc('mark_task_done', …) від імені користувача. */
const mark = (userId: string, taskId: string) =>
  t.asUser(userId, "select public.mark_task_done($1)", [taskId]).then(
    () => "",
    (e: Error) => e.message,
  );

/** Задачі запуску в обхід RLS — для підготовки й перевірки результату. */
const tasksOf = (runId: string) =>
  t.asService<TaskRow>(
    `select t.id, t.name, t.status, t.assignee_id, t.is_required
     from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
     where t.run_id = $1 order by s.position, t.position`,
    [runId],
  );

const runStatus = async (runId: string) =>
  (await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]))[0].status;

const taskStatus = async (taskId: string) =>
  (await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [taskId]))[0].status;

const templateTaskIds = async () =>
  (
    await t.asService<{ id: string }>(
      `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
       where tt.template_id = $1 order by s.position, tt.position`,
      [TENANT_MOVE_IN],
    )
  ).map((r) => r.id);

/** Запуск менеджера A, у якому першу задачу шаблону призначено менеджеру B. */
async function runOfAWithTaskForB(caseName: string) {
  const [first] = await templateTaskIds();
  const runId = await launch(MANAGER_A, caseName, { [first]: MANAGER_B });
  const tasks = await tasksOf(runId);
  const taskOfB = tasks.find((task) => task.assignee_id === MANAGER_B)!;
  return { runId, tasks, taskOfB };
}

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  MANAGER_C = t.users["manager.c@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: позначка задачі виконаною", () => {
  it("AC-TASK-01: виконавець (менеджер B) позначає свою задачу в запуску менеджера A → «done»", async () => {
    const { runId, taskOfB } = await runOfAWithTaskForB("AC-TASK-01 run");
    expect(await runStatus(runId)).toBe("in_progress");
    expect(taskOfB.status).toBe("to_do");

    expect(await mark(MANAGER_B, taskOfB.id)).toBe("");
    expect(await taskStatus(taskOfB.id)).toBe("done");
  });

  it("AC-TASK-01: повторна позначка задачі «done» нічого не змінює і не є помилкою", async () => {
    const { taskOfB } = await runOfAWithTaskForB("AC-TASK-01 repeat");
    await mark(MANAGER_B, taskOfB.id);

    expect(await mark(MANAGER_B, taskOfB.id)).toBe("");
    expect(await taskStatus(taskOfB.id)).toBe("done");
  });

  it("AC-TASK-02: менеджер запуску A позначає задачу виконавця B → «done»", async () => {
    const { taskOfB } = await runOfAWithTaskForB("AC-TASK-02 run");

    expect(await mark(MANAGER_A, taskOfB.id)).toBe("");
    expect(await taskStatus(taskOfB.id)).toBe("done");
  });

  it("AC-TASK-07: адміністратор, який не створював запуску, позначає задачу менеджера B → «done»", async () => {
    const { taskOfB } = await runOfAWithTaskForB("AC-TASK-07 run");

    expect(await mark(ADMIN, taskOfB.id)).toBe("");
    expect(await taskStatus(taskOfB.id)).toBe("done");
  });
});

describe("База: відмова в позначці", () => {
  it("AC-TASK-03: менеджер C (не менеджер запуску і не виконавець) → NOT_ALLOWED, задача лишається «to do»", async () => {
    const { taskOfB } = await runOfAWithTaskForB("AC-TASK-03 run");

    expect(await mark(MANAGER_C, taskOfB.id)).toContain("NOT_ALLOWED");
    expect(await taskStatus(taskOfB.id)).toBe("to_do");
  });

  it("AC-TASK-03: співвиконавець іншої задачі того самого запуску теж не позначає задачу B", async () => {
    const [first, second] = await templateTaskIds();
    const runId = await launch(MANAGER_A, "AC-TASK-03 co-assignee", { [first]: MANAGER_B, [second]: MANAGER_C });
    const taskOfB = (await tasksOf(runId)).find((task) => task.assignee_id === MANAGER_B)!;

    expect(await mark(MANAGER_C, taskOfB.id)).toContain("NOT_ALLOWED");
    expect(await taskStatus(taskOfB.id)).toBe("to_do");
  });

  it("AC-TASK-03: відсутня задача — та сама відповідь NOT_ALLOWED; без входу виклик заборонено", async () => {
    expect(await mark(MANAGER_C, "c0000000-0000-0000-0000-000000000000")).toContain("NOT_ALLOWED");
    const { taskOfB } = await runOfAWithTaskForB("AC-TASK-03 anon");
    await expect(t.asAnon("select public.mark_task_done($1)", [taskOfB.id])).rejects.toThrow(/permission denied/);
    await expect(t.asUser(MANAGER_C, "update public.run_tasks set status = 'done' where id = $1", [taskOfB.id])).rejects.toThrow(
      /permission denied/,
    );
    expect(await taskStatus(taskOfB.id)).toBe("to_do");
  });
});

describe("База: завершення запуску", () => {
  it("AC-TASK-04: 5 задач, 3 обов'язкові; після третьої обов'язкової «done» запуск «completed»", async () => {
    const runId = await launch(MANAGER_A, "AC-TASK-04 run");
    const tasks = await tasksOf(runId);
    const required = tasks.filter((task) => task.is_required);
    const optional = tasks.filter((task) => !task.is_required);
    expect(tasks).toHaveLength(5);
    expect(required).toHaveLength(3);

    await mark(MANAGER_A, required[0].id);
    await mark(MANAGER_A, required[1].id);
    expect(await runStatus(runId)).toBe("in_progress");

    await mark(MANAGER_A, required[2].id);
    expect(await runStatus(runId)).toBe("completed");
    // Необов'язкові задачі статус запуску не тримають і самі не змінюються («Припущення» PM).
    for (const task of optional) expect(await taskStatus(task.id)).toBe("to_do");
  });
});

describe("База: прогрес і статуси задач", () => {
  /** Запуск менеджера A з 5 задачами, 2 з яких «done»: одну позначає менеджер B, другу — менеджер A. */
  async function runWithTwoDone(caseName: string) {
    const { runId, tasks, taskOfB } = await runOfAWithTaskForB(caseName);
    const other = tasks.find((task) => task.id !== taskOfB.id)!;
    await mark(MANAGER_B, taskOfB.id);
    await mark(MANAGER_A, other.id);
    return runId;
  }

  const overviewFor = async (userId: string, runId: string) =>
    (
      await t.asUser<{ done_count: number; total_count: number }>(
        userId,
        "select done_count, total_count from public.run_overview where id = $1",
        [runId],
      )
    )[0];

  it("AC-TASK-05: запуск з 5 задач, 2 «done» → менеджер запуску бачить прогрес «2 of 5 done»", async () => {
    const runId = await runWithTwoDone("AC-TASK-05 run");
    const overview = await overviewFor(MANAGER_A, runId);

    expect(overview).toEqual({ done_count: 2, total_count: 5 });
    expect(formatProgress(overview.done_count, overview.total_count)).toBe("2 of 5 done");
  });

  it("AC-TASK-09: у списку запусків менеджера A цей запуск має прогрес «2 of 5 done»", async () => {
    const runId = await runWithTwoDone("AC-TASK-09 run");
    const list = await t.asUser<{ id: string; done_count: number; total_count: number }>(
      MANAGER_A,
      "select id, done_count, total_count from public.run_overview order by created_at desc",
    );
    const row = list.find((r) => r.id === runId)!;

    expect(row).toBeDefined();
    expect(formatProgress(row.done_count, row.total_count)).toBe("2 of 5 done");
  });

  it("AC-TASK-08: менеджер запуску бачить для кожної з 5 задач «done» чи «to do» (2 і 3)", async () => {
    const runId = await runWithTwoDone("AC-TASK-08 run");
    const statuses = (
      await t.asUser<{ status: string }>(MANAGER_A, "select status from public.run_tasks where run_id = $1", [runId])
    ).map((r) => r.status);

    expect(statuses).toHaveLength(5);
    expect(statuses.filter((s) => s === "done")).toHaveLength(2);
    expect(statuses.filter((s) => s === "to_do")).toHaveLength(3);
  });

  it("AC-TASK-08: виконавець однієї задачі бачить статуси всіх 5 задач запуску", async () => {
    const runId = await runWithTwoDone("AC-TASK-08 assignee");
    const rows = await t.asUser(MANAGER_B, "select status from public.run_tasks where run_id = $1", [runId]);

    expect(rows).toHaveLength(5);
  });
});

describe("База: видимість запусків", () => {
  // Окрема база з рівно трьома запусками зі сценарію AC-TASK-06; їх створює beforeAll, тож кожен тест блоку
  // перевіряє ці запуски й тоді, коли його запущено окремо.
  let v: TestDb;
  let firstOfA: string, secondOfA: string, ownOfB: string;

  beforeAll(async () => {
    v = await createTestDb();
    const a = v.users["manager.a@example.test"];
    const b = v.users["manager.b@example.test"];
    const [first] = (
      await v.asService<{ id: string }>(
        `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
         where tt.template_id = $1 order by s.position, tt.position`,
        [TENANT_MOVE_IN],
      )
    ).map((r) => r.id);
    const launchAs = async (userId: string, caseName: string, assignments: Record<string, string> = {}) =>
      (
        await v.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
          TENANT_MOVE_IN,
          caseName,
          assignments,
        ])
      )[0].id;

    firstOfA = await launchAs(a, "First run of A", { [first]: b });
    secondOfA = await launchAs(a, "Second run of A");
    ownOfB = await launchAs(b, "Run of B");
  }, 60_000);

  afterAll(async () => {
    await v.db.close();
  });

  it("AC-TASK-06: менеджер B бачить свій запуск і перший запуск менеджера A, де він виконавець, але не другий", async () => {
    const b = v.users["manager.b@example.test"];
    const visible = (await v.asUser<{ id: string }>(b, "select id from public.run_overview")).map((r) => r.id);
    expect(visible).toHaveLength(2);
    expect(visible).toEqual(expect.arrayContaining([ownOfB, firstOfA]));
    expect(visible).not.toContain(secondOfA);

    // Чужий запуск не видно й на сторінці запуску: ні запуску, ні його задач.
    expect(await v.asUser(b, "select id from public.runs where id = $1", [secondOfA])).toHaveLength(0);
    expect(await v.asUser(b, "select id from public.run_tasks where run_id = $1", [secondOfA])).toHaveLength(0);
  });

  it("AC-TASK-06: адміністратор бачить усі запуски", async () => {
    const seenByAdmin = (await v.asUser<{ id: string }>(v.users["admin@example.test"], "select id from public.run_overview")).map(
      (r) => r.id,
    );

    expect(seenByAdmin).toHaveLength(3);
    expect(seenByAdmin).toEqual(expect.arrayContaining([firstOfA, secondOfA, ownOfB]));
  });
});
