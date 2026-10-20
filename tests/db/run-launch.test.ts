// Запуск шаблону — правила, які виконує база (функція launch_run, RLS, GRANT), на справжньому Postgres (PGlite)
// з усіма міграціями. Ці тести покривають AC-RUN-* у docs/conformance.md (специфікація openspec/specs/run-launch).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string;

interface RunRow {
  id: string;
  status: string;
  run_manager_id: string;
  case_name: string;
}
interface TaskRow {
  id: string;
  name: string;
  status: string;
  assignee_id: string;
  is_required: boolean;
}

/** Запуск так, як його робить server action launchRun: supabase.rpc('launch_run', …) від імені користувача. */
async function launch(db: TestDb, userId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await db.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    TENANT_MOVE_IN,
    caseName,
    assignments,
  ]);
  return row.id;
}

const launchError = (db: TestDb, userId: string, caseName: string, assignments: Record<string, string> = {}) =>
  launch(db, userId, caseName, assignments).then(
    () => "",
    (e: Error) => e.message,
  );

const runOf = async (db: TestDb, userId: string, runId: string) =>
  (await db.asUser<RunRow>(userId, "select id, status, run_manager_id, case_name from public.runs where id = $1", [runId]))[0];

const tasksOf = (db: TestDb, userId: string, runId: string) =>
  db.asUser<TaskRow>(
    userId,
    `select t.id, t.name, t.status, t.assignee_id, t.is_required
     from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
     where t.run_id = $1 order by s.position, t.position`,
    [runId],
  );

const countRuns = async (db: TestDb, caseName: string) =>
  (await db.asService<{ n: number }>("select count(*)::int as n from public.runs where case_name = $1", [caseName]))[0].n;

const templateTaskIds = async (db: TestDb) =>
  (
    await db.asService<{ id: string }>(
      `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
       where tt.template_id = $1 order by s.position, tt.position`,
      [TENANT_MOVE_IN],
    )
  ).map((r) => r.id);

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: запуск шаблону", () => {
  it("AC-RUN-01: «Tenant move-in» (2 розділи, 5 задач, 3 обов'язкові) → рівно один запуск «in progress» з 5 задачами «to do»", async () => {
    const [shape] = await t.asUser<{ sections: number; tasks: number; required: number }>(
      MANAGER_A,
      `select (select count(*)::int from public.template_sections where template_id = $1) as sections,
              (select count(*)::int from public.template_tasks where template_id = $1) as tasks,
              (select count(*)::int from public.template_tasks where template_id = $1 and is_required) as required`,
      [TENANT_MOVE_IN],
    );
    expect(shape).toEqual({ sections: 2, tasks: 5, required: 3 });

    const runId = await launch(t, MANAGER_A, "Apartment 12, move-in");

    expect(await countRuns(t, "Apartment 12, move-in")).toBe(1);
    expect((await runOf(t, MANAGER_A, runId)).status).toBe("in_progress");
    const tasks = await tasksOf(t, MANAGER_A, runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.status === "to_do")).toBe(true);
  });

  it("AC-RUN-01: запуск змінює лише функція — прямий insert у runs і run_tasks заборонено", async () => {
    await expect(
      t.asUser(
        MANAGER_A,
        "insert into public.runs (template_name, case_name, run_manager_id) values ('X', 'Direct', $1)",
        [MANAGER_A],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select public.launch_run($1, 'Anon', '{}'::jsonb)", [TENANT_MOVE_IN])).rejects.toThrow(
      /permission denied/,
    );
    expect(await countRuns(t, "Direct")).toBe(0);
    expect(await countRuns(t, "Anon")).toBe(0);
  });

  it("AC-RUN-01: прямий запис у run_sections і run_tasks заборонено — ні insert, ні update статусу", async () => {
    const runId = await launch(t, MANAGER_A, "Direct writes check");
    await expect(
      t.asUser(MANAGER_A, "insert into public.run_sections (run_id, name, position) values ($1, 'X', 99)", [runId]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(
        MANAGER_A,
        `insert into public.run_tasks (run_id, section_id, name, is_required, position, assignee_id)
         select run_id, id, 'X', false, 99, $2 from public.run_sections where run_id = $1 limit 1`,
        [runId, MANAGER_A],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(MANAGER_A, "update public.run_tasks set status = 'done' where run_id = $1", [runId]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(MANAGER_A, "update public.runs set status = 'completed' where id = $1", [runId]),
    ).rejects.toThrow(/permission denied/);

    const tasks = await tasksOf(t, MANAGER_A, runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.status === "to_do")).toBe(true);
  });

  it("AC-RUN-05: адміністратор запускає «Tenant move-in» для «Apartment 14, move-in» → один запуск, менеджер запуску — адміністратор", async () => {
    const runId = await launch(t, ADMIN, "Apartment 14, move-in");

    expect(await countRuns(t, "Apartment 14, move-in")).toBe(1);
    expect((await runOf(t, ADMIN, runId)).run_manager_id).toBe(ADMIN);
  });

  it("AC-RUN-06: менеджер A запускає «Tenant move-in» → менеджер A — менеджер запуску", async () => {
    const runId = await launch(t, MANAGER_A, "Apartment 12, move-in (AC-RUN-06)");

    expect((await runOf(t, MANAGER_A, runId)).run_manager_id).toBe(MANAGER_A);
  });
});

describe("База: виконавці задач під час запуску", () => {
  it("AC-RUN-04: менеджер A призначає менеджера B виконавцем двох задач → 2 задачі в B, решта 3 — в A", async () => {
    const [first, second] = await templateTaskIds(t);
    const runId = await launch(t, MANAGER_A, "Apartment 15, move-in", { [first]: MANAGER_B, [second]: MANAGER_B });

    const tasks = await tasksOf(t, MANAGER_A, runId);
    expect(tasks.filter((task) => task.assignee_id === MANAGER_B)).toHaveLength(2);
    expect(tasks.filter((task) => task.assignee_id === MANAGER_A)).toHaveLength(3);
  });

  it("AC-RUN-04: виконавцем не може бути хтось, крім менеджера чи адміністратора — запуску немає", async () => {
    const [first] = await templateTaskIds(t);
    const stranger = "b0000000-0000-0000-0000-000000000099";

    expect(await launchError(t, MANAGER_A, "Apartment 16, move-in", { [first]: stranger })).toContain("INVALID_ASSIGNEE");
    expect(await countRuns(t, "Apartment 16, move-in")).toBe(0);
  });

  it("AC-RUN-08: менеджер A запускає шаблон без призначень → менеджер A — виконавець усіх 5 задач", async () => {
    const runId = await launch(t, MANAGER_A, "Apartment 17, move-in");

    const tasks = await tasksOf(t, MANAGER_A, runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.assignee_id === MANAGER_A)).toBe(true);
  });

  it("AC-RUN-09: адміністратор запускає шаблон без призначень → адміністратор — виконавець усіх 5 задач", async () => {
    const runId = await launch(t, ADMIN, "Apartment 18, move-in");

    const tasks = await tasksOf(t, ADMIN, runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.every((task) => task.assignee_id === ADMIN)).toBe(true);
  });
});

describe("База: назва випадку", () => {
  it("AC-RUN-03: порожня назва і назва лише з пробілів → CASE_NAME_REQUIRED, запуску немає", async () => {
    const before = (await t.asService<{ n: number }>("select count(*)::int as n from public.runs"))[0].n;

    expect(await launchError(t, MANAGER_A, "")).toContain("CASE_NAME_REQUIRED");
    expect(await launchError(t, MANAGER_A, "     ")).toContain("CASE_NAME_REQUIRED");

    const after = (await t.asService<{ n: number }>("select count(*)::int as n from public.runs"))[0].n;
    expect(after).toBe(before);
  });

  it("AC-RUN-07: назва з 101 символу → CASE_NAME_TOO_LONG, запуску немає; 100 символів — запуск є", async () => {
    const name101 = "A".repeat(101);
    const name100 = "B".repeat(100);

    expect(await launchError(t, MANAGER_A, name101)).toContain("CASE_NAME_TOO_LONG");
    expect(await countRuns(t, name101)).toBe(0);

    await launch(t, MANAGER_A, name100);
    expect(await countRuns(t, name100)).toBe(1);
  });

  it("AC-RUN-03: пробіли на краях назви обрізаються перед перевіркою і збереженням", async () => {
    const runId = await launch(t, MANAGER_A, "   Apartment 19, move-in   ");

    expect((await runOf(t, MANAGER_A, runId)).case_name).toBe("Apartment 19, move-in");
  });
});

describe("База: назва випадку — пробільні символи Unicode", () => {
  it("AC-RUN-03: назва лише з нерозривних та інших Unicode-пробілів → CASE_NAME_REQUIRED, як у формі", async () => {
    for (const blank of ["\u00a0", "\u00a0\u2007\u202f", "\ufeff", "\u3000 \u00a0"]) {
      expect(await launchError(t, MANAGER_A, blank)).toContain("CASE_NAME_REQUIRED");
    }
  });

  it("AC-RUN-03: нерозривні пробіли на краях обрізаються перед збереженням", async () => {
    const runId = await launch(t, MANAGER_A, "\u00a0Flat 1, move-in\u00a0");

    expect((await runOf(t, MANAGER_A, runId)).case_name).toBe("Flat 1, move-in");
  });

  it("AC-RUN-03: прямий запис назви з пробілом на краю відхиляє check-обмеження бази", async () => {
    await expect(
      t.asService(
        "insert into public.runs (template_name, case_name, run_manager_id) values ('X', $1, $2)",
        ["Flat 2\u00a0", MANAGER_A],
      ),
    ).rejects.toThrow(/runs_case_name_check/);
  });
});

describe("База: цілісність шаблону", () => {
  it("AC-RUN-04: UUID виконавця у верхньому регістрі теж застосовується", async () => {
    const [first] = await templateTaskIds(t);
    const runId = await launch(t, MANAGER_A, "Apartment 20, move-in", { [first.toUpperCase()]: MANAGER_B.toUpperCase() });

    const tasks = await tasksOf(t, MANAGER_A, runId);
    expect(tasks.filter((task) => task.assignee_id === MANAGER_B)).toHaveLength(1);
  });

  it("AC-RUN-01: ключі однієї задачі в різному регістрі відхиляються — запуску немає, задача не дублюється", async () => {
    // Окремий шаблон з UUID, де є літери: у сид-шаблонів ID лише з цифр, і toUpperCase() їх не змінює.
    const template = "abcdef00-0000-4000-8000-0000000000aa";
    const section = "abcdef00-0000-4000-8000-0000000000bb";
    const task = "abcdef00-0000-4000-8000-0000000000cc";
    await t.asService("insert into public.templates (id, name) values ($1, 'Mixed-case keys')", [template]);
    await t.asService("insert into public.template_sections (id, template_id, name, position) values ($1, $2, 'Only', 1)", [
      section,
      template,
    ]);
    await t.asService(
      "insert into public.template_tasks (id, template_id, section_id, name, is_required, position) values ($1, $2, $3, 'Only task', true, 1)",
      [task, template, section],
    );

    const error = await t
      .asUser(MANAGER_A, "select public.launch_run($1, $2, $3) as id", [
        template,
        "Apartment 21, move-in",
        { [task]: MANAGER_A, [task.toUpperCase()]: MANAGER_B },
      ])
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(error).toContain("INVALID_ASSIGNEE");
    expect(await countRuns(t, "Apartment 21, move-in")).toBe(0);

    // Один ключ у верхньому регістрі — звичайне призначення, задача одна.
    const [row] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2, $3) as id", [
      template,
      "Apartment 22, move-in",
      { [task.toUpperCase()]: MANAGER_B },
    ]);
    const tasks = await tasksOf(t, MANAGER_A, row.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assignee_id).toBe(MANAGER_B);
  });

  it("AC-RUN-01: задача шаблону не може посилатися на розділ іншого шаблону", async () => {
    await expect(
      t.asService(
        `insert into public.template_tasks (template_id, section_id, name, is_required, position)
         values ($1, '10000000-0000-4000-8000-000000000021', 'Wrong section', false, 9)`,
        [TENANT_MOVE_IN],
      ),
    ).rejects.toThrow(/template_tasks_section_template_fkey/);
  });
});

describe("База: незмінність запуску", () => {
  // Окрема база: тест змінює шаблон «Tenant move-in», а решта тестів очікує його в початковому вигляді.
  let isolated: TestDb;
  beforeAll(async () => {
    isolated = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await isolated.db.close();
  });

  it("AC-RUN-02: шаблон змінюють (додають шосту задачу, перейменовують першу) → запуск має ті самі 5 задач з початковими назвами", async () => {
    const manager = isolated.users["manager.a@example.test"];
    const runId = await launch(isolated, manager, "Apartment 12, move-in");
    const before = (await tasksOf(isolated, manager, runId)).map((task) => task.name);

    await isolated.asService(
      `insert into public.template_tasks (template_id, section_id, name, is_required, position)
       select template_id, id, 'Sixth task', false, 9 from public.template_sections where template_id = $1 and position = 1`,
      [TENANT_MOVE_IN],
    );
    await isolated.asService(
      "update public.template_tasks set name = 'Renamed first task' where template_id = $1 and name = $2",
      [TENANT_MOVE_IN, before[0]],
    );

    const after = (await tasksOf(isolated, manager, runId)).map((task) => task.name);
    expect(after).toHaveLength(5);
    expect(after).toEqual(before);
  });
});
