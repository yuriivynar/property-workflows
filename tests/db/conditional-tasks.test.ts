// Задача лише для певної відповіді — правила, які виконує база (launch_run, set_run_field_answer, mark_task_done,
// run_overview, RLS), на справжньому Postgres (PGlite) з усіма міграціями. Покривають AC-LOGIC-* у docs/conformance.md
// (специфікація openspec/specs/conditional-tasks; план — openspec/changes/impl-conditional-tasks/design.md).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatProgress } from "../../src/lib/runs/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

const REPAIR = "10000000-0000-4000-8000-000000000003";
const PLUMBER = "Send an emergency plumber";

let t: TestDb;
let ADMIN: string, MANAGER_A: string, MANAGER_B: string, VENDOR: string;

interface TaskRow {
  id: string;
  name: string;
  status: string;
  is_required: boolean;
  is_shown: boolean;
  assignee_id: string;
}

const errorOf = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: Error) => e.message,
  );

async function launch(userId: string, caseName: string, assignments: Record<string, string> = {}) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3) as id", [
    REPAIR,
    caseName,
    assignments,
  ]);
  return row.id;
}

const templateTaskId = async (name: string) =>
  (await t.asService<{ id: string }>("select id from public.template_tasks where template_id = $1 and name = $2", [
    REPAIR,
    name,
  ]))[0].id;

const fieldOf = async (runId: string) =>
  (await t.asService<{ id: string; answer: string | null }>("select id, answer from public.run_fields where run_id = $1", [
    runId,
  ]))[0];

const answer = (userId: string, fieldId: string, value: string | null) =>
  errorOf(t.asUser(userId, "select public.set_run_field_answer($1, $2)", [fieldId, value]));

const mark = (userId: string, taskId: string, confirmed = true) =>
  errorOf(t.asUser(userId, "select public.mark_task_done($1, $2)", [taskId, confirmed]));

/** Задачі запуску, які бачить користувач (RLS), — з позначкою, чи показано. */
const visibleTasks = (userId: string, runId: string) =>
  t.asUser<TaskRow>(
    userId,
    `select t.id, t.name, t.status, t.is_required, t.is_shown, t.assignee_id
     from public.run_tasks as t join public.run_sections as s on s.id = t.section_id
     where t.run_id = $1 order by s.position, t.position`,
    [runId],
  );

const shownTasks = async (userId: string, runId: string) =>
  (await visibleTasks(userId, runId)).filter((task) => task.is_shown);

const progress = async (userId: string, runId: string) => {
  const [row] = await t.asUser<{ done_count: number; total_count: number }>(
    userId,
    "select done_count, total_count from public.run_overview where id = $1",
    [runId],
  );
  return formatProgress(row.done_count, row.total_count);
};

const runStatus = async (runId: string) =>
  (await t.asService<{ status: string }>("select status from public.runs where id = $1", [runId]))[0].status;

const taskStatus = async (taskId: string) =>
  (await t.asService<{ status: string }>("select status from public.run_tasks where id = $1", [taskId]))[0].status;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  MANAGER_A = t.users["manager.a@example.test"];
  MANAGER_B = t.users["manager.b@example.test"];
  VENDOR = t.users["vendor@example.test"];
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

describe("База: поле «Urgency» і задача лише для «urgent»", () => {
  it("AC-LOGIC-01: шаблон «Repair» — 4 задачі, «Send an emergency plumber» лише для «urgent»; запуск — поле без відповіді, 3 задачі, «0 of 3 done»", async () => {
    const tasks = await t.asService<{ name: string; show_when_value: string | null }>(
      "select name, show_when_value from public.template_tasks where template_id = $1",
      [REPAIR],
    );
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((task) => task.show_when_value === "urgent").map((task) => task.name)).toEqual([PLUMBER]);

    const runId = await launch(MANAGER_A, "Apartment 7, leak");

    const fields = await t.asUser<{ name: string; options: string[]; answer: string | null }>(
      MANAGER_A,
      "select name, options, answer from public.run_fields where run_id = $1",
      [runId],
    );
    expect(fields).toEqual([{ name: "Urgency", options: ["urgent", "not urgent"], answer: null }]);
    const shown = await shownTasks(MANAGER_A, runId);
    expect(shown).toHaveLength(3);
    expect(shown.map((task) => task.name)).not.toContain(PLUMBER);
    expect(await progress(MANAGER_A, runId)).toBe("0 of 3 done");
  });

  it("AC-LOGIC-02: менеджер запуску A відповідає «urgent» → 4 задачі, «Send an emergency plumber» «to do», «0 of 4 done»", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, leak");
    const field = await fieldOf(runId);

    expect(await answer(MANAGER_A, field.id, "urgent")).toBe("");

    expect((await fieldOf(runId)).answer).toBe("urgent");
    const shown = await shownTasks(MANAGER_A, runId);
    expect(shown).toHaveLength(4);
    expect(shown.find((task) => task.name === PLUMBER)?.status).toBe("to_do");
    expect(await progress(MANAGER_A, runId)).toBe("0 of 4 done");
  });

  it("AC-LOGIC-02: адміністратор відповідає на поле чужого запуску так само, як менеджер запуску", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, admin answers");
    const field = await fieldOf(runId);

    expect(await answer(ADMIN, field.id, "urgent")).toBe("");
    expect(await shownTasks(MANAGER_A, runId)).toHaveLength(4);
  });

});

describe("База: прихована задача й зміна відповіді", () => {
  it("AC-LOGIC-03: «not urgent», 2 з 3 показаних обов'язкових «done» — третя з підтвердженням завершує запуск, прихована не блокує", async () => {
    const third = await templateTaskId("Check the result");
    const runId = await launch(MANAGER_A, "Apartment 7, not urgent", { [third]: MANAGER_B });
    await answer(MANAGER_A, (await fieldOf(runId)).id, "not urgent");
    const shown = await shownTasks(MANAGER_A, runId);
    expect(shown).toHaveLength(3);
    const all = await visibleTasks(MANAGER_A, runId);
    const plumber = all.find((task) => task.name === PLUMBER)!;
    expect(plumber).toMatchObject({ is_required: true, is_shown: false });

    const [first, second, last] = shown;
    expect(await mark(MANAGER_A, first.id)).toBe("");
    expect(await mark(MANAGER_A, second.id)).toBe("");
    expect(last.assignee_id).toBe(MANAGER_B);

    // Третя показана — остання обов'язкова: без підтвердження відмова, з підтвердженням — «completed».
    expect(await mark(MANAGER_B, last.id, false)).toContain("CONFIRMATION_REQUIRED");
    expect(await mark(MANAGER_B, last.id)).toBe("");
    expect(await runStatus(runId)).toBe("completed");
    expect(await progress(MANAGER_A, runId)).toBe("3 of 3 done");
  });

  it("AC-LOGIC-03: поле без відповіді — умовна задача прихована і теж не блокує завершення", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, unanswered");
    for (const task of await shownTasks(MANAGER_A, runId)) {
      expect(await mark(MANAGER_A, task.id)).toBe("");
    }
    expect(await runStatus(runId)).toBe("completed");
  });

  it("AC-LOGIC-04: «urgent», задача «done» → «not urgent» → знову «urgent» — «Send an emergency plumber» «to do», а не «done»", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, leak");
    const field = await fieldOf(runId);
    await answer(MANAGER_A, field.id, "urgent");
    const plumber = (await shownTasks(MANAGER_A, runId)).find((task) => task.name === PLUMBER)!;
    expect(await mark(MANAGER_A, plumber.id)).toBe("");
    expect(await taskStatus(plumber.id)).toBe("done");

    expect(await answer(MANAGER_A, field.id, "not urgent")).toBe("");
    expect((await shownTasks(MANAGER_A, runId)).map((task) => task.name)).not.toContain(PLUMBER);
    expect(await answer(MANAGER_A, field.id, "urgent")).toBe("");

    const again = (await shownTasks(MANAGER_A, runId)).find((task) => task.name === PLUMBER);
    expect(again?.status).toBe("to_do");
  });

  it("AC-LOGIC-05: менеджер B — виконавець задачі, але не менеджер запуску — відповідь та сама, відмова ANSWER_NOT_ALLOWED", async () => {
    const first = await templateTaskId("Inspect the leak");
    const runId = await launch(MANAGER_A, "Apartment 7, leak", { [first]: MANAGER_B });
    const field = await fieldOf(runId);
    await answer(MANAGER_A, field.id, "not urgent");

    expect(await answer(MANAGER_B, field.id, "urgent")).toContain("ANSWER_NOT_ALLOWED");

    expect((await fieldOf(runId)).answer).toBe("not urgent");
    expect((await shownTasks(MANAGER_B, runId)).map((task) => task.name)).not.toContain(PLUMBER);
  });
});

describe("База: зміна відповіді — межі (рішення розробника, design.md)", () => {
  it("вендор не змінює відповіді й не бачить поля, відповіді та прихованих задач", async () => {
    const plumber = await templateTaskId(PLUMBER);
    const first = await templateTaskId("Inspect the leak");
    const runId = await launch(MANAGER_A, "Apartment 7, vendor", { [plumber]: VENDOR, [first]: VENDOR });
    const field = await fieldOf(runId);

    expect(await answer(VENDOR, field.id, "urgent")).toContain("ANSWER_NOT_ALLOWED");
    expect(await t.asUser(VENDOR, "select * from public.run_fields where run_id = $1", [runId])).toEqual([]);
    expect((await visibleTasks(VENDOR, runId)).map((task) => task.name)).toEqual(["Inspect the leak"]);
    const vendorTasks = await t.asUser<{ name: string }>(VENDOR, "select name from public.vendor_run_tasks($1)", [runId]);
    expect(vendorTasks.map((task) => task.name)).toEqual(["Inspect the leak"]);
    const [vendorRun] = await t.asUser<{ my_total: number }>(
      VENDOR,
      "select my_total from public.vendor_runs() where id = $1",
      [runId],
    );
    expect(vendorRun.my_total).toBe(1);

    await answer(MANAGER_A, field.id, "urgent");
    expect((await visibleTasks(VENDOR, runId)).map((task) => task.name)).toEqual(["Inspect the leak", PLUMBER]);
  });

  it("приховану задачу не позначити виконаною; відповідь лише з переліку; та сама відповідь нічого не змінює", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, edges");
    const field = await fieldOf(runId);
    const plumber = (await visibleTasks(MANAGER_A, runId)).find((task) => task.name === PLUMBER)!;

    expect(await mark(MANAGER_A, plumber.id)).toContain("NOT_ALLOWED");
    expect(await answer(MANAGER_A, field.id, "Urgent")).toContain("INVALID_ANSWER");
    expect((await fieldOf(runId)).answer).toBeNull();

    await answer(MANAGER_A, field.id, "urgent");
    await mark(MANAGER_A, plumber.id);
    expect(await answer(MANAGER_A, field.id, "urgent")).toBe("");
    expect(await taskStatus(plumber.id)).toBe("done");
  });

  it("відповідь у завершеному запуску, що показує обов'язкову задачу, повертає запуск до «in progress»", async () => {
    const runId = await launch(MANAGER_A, "Apartment 7, reopened");
    const field = await fieldOf(runId);
    await answer(MANAGER_A, field.id, "not urgent");
    for (const task of await shownTasks(MANAGER_A, runId)) await mark(MANAGER_A, task.id);
    expect(await runStatus(runId)).toBe("completed");

    await answer(MANAGER_A, field.id, "urgent");
    expect(await runStatus(runId)).toBe("in_progress");
    await answer(MANAGER_A, field.id, "not urgent");
    expect(await runStatus(runId)).toBe("completed");
  });

  it("наявні шаблони без полів запускаються як раніше: полів немає, усі задачі показано", async () => {
    const [{ id: runId }] = await t.asUser<{ id: string }>(MANAGER_A, "select public.launch_run($1, $2) as id", [
      "10000000-0000-4000-8000-000000000001",
      "Apartment 12, move-in",
    ]);
    expect(await t.asUser(MANAGER_A, "select * from public.run_fields where run_id = $1", [runId])).toEqual([]);
    expect(await progress(MANAGER_A, runId)).toBe("0 of 5 done");
  });
});
