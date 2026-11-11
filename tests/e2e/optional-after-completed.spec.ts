// AC-TASK-19, AC-VENDOR-16 — необов'язкову задачу запуску «completed» її виконавець ще може позначити виконаною: запуск
// лишається «completed», прогрес (і «Your tasks» вендора) її рахує (рішення PM solomchaak/property-workflows-spec#46).
// Пишуть дані: синтетичні користувачі uat-<run>-…@example.test і запуски через справжню launch_run; прибирання —
// Cast.dispose. Тег @writes.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  Cast,
  TENANT_MOVE_IN,
  clientFor,
  currentTemplate,
  launchAs,
  runTasks,
  signInAs,
  type Actor,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/** Менеджер запуску позначає всі обов'язкові задачі справжньою mark_task_done (остання — з підтвердженням). */
async function completeRequired(manager: Actor, runId: string) {
  const client = await clientFor(manager);
  for (const task of (await runTasks(runId)).filter((candidate) => candidate.isRequired)) {
    const { error } = await client.rpc("mark_task_done", { p_task_id: task.id, p_confirmed: true });
    expect(error).toBeNull();
  }
}

test(
  "AC-TASK-19: виконавець позначає необов'язкову задачу «to do» запуску «completed» — задача «done», запуск лишається «completed», прогрес її рахує",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-TASK-19" } },
  async ({ page }) => {
    const cast = new Cast("t19");
    try {
      let runId = "";
      let optionalName = "";
      let total = 0;
      let required = 0;

      await given(
        'a run with status "completed" that has an optional task with status "to do", and the assignee of this task',
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          const assignee = await cast.create("mgr-b", "manager");
          const { tasks: templateTasks } = await currentTemplate(TENANT_MOVE_IN);
          const optional = templateTasks.find((task) => !task.isRequired)!;
          optionalName = optional.name;
          runId = await launchAs(manager, TENANT_MOVE_IN, APARTMENT_12, { [optional.id]: assignee.id });
          await completeRequired(manager, runId);
          const tasks = await runTasks(runId);
          total = tasks.length;
          required = tasks.filter((task) => task.isRequired).length;
          expect(tasks.find((task) => task.name === optionalName)?.status).toBe("to_do");
          await signInAs(page, assignee);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("run-status")).toHaveText("completed");
          await expect(page.getByTestId("run-progress")).toHaveText(`${required} of ${total} done`);
        },
      );

      await when(`the assignee marks "${optionalName || "the optional task"}" as done`, async () => {
        const row = page.getByTestId("run-task").filter({ hasText: optionalName });
        await row.getByRole("button", { name: "Mark as done" }).click();
        await expect(row.getByTestId("task-status")).toHaveText("done");
      });

      await thenStep(
        page,
        {
          clause: 'the task has status "done", the run stays "completed", and the progress counts the task as done.',
          visible: [
            `необов'язкова задача «${optionalName}» (optional) зі статусом «done» — на місці «Order a part» з AC: такої задачі в шаблоні «Tenant move-in» на проді немає, тож тест бере його необов'язкову задачу`,
            "статус запуску «completed»",
            `прогрес «${required + 1} of ${total} done»: ${required} обов'язкові задачі були «done» ще до дії (тому запуск «completed»), +1 — ця задача`,
          ],
          hidden: [
            `до дії прогрес був «${required} of ${total} done», а задача — «to do» (перевірено в «Дано»)`,
            "у базі задача «done», запуск «completed»",
          ],
        },
        async () => {
          await expect(page.getByTestId("run-task").filter({ hasText: optionalName }).getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("run-status")).toHaveText("completed");
          await expect(page.getByTestId("run-progress")).toHaveText(`${required + 1} of ${total} done`);
          expect((await runTasks(runId)).find((task) => task.name === optionalName)?.status).toBe("done");
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-16: вендор V позначає свою необов'язкову задачу 3 у «Apartment 12, move-in» зі статусом «completed» — «done», «Your tasks: 1 of 1 done», запуск лишається «completed»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-16" } },
  async ({ page }) => {
    const cast = new Cast("v16");
    try {
      let runId = "";
      let task3Name = "";

      await given(
        'the run "Apartment 12, move-in" with status "completed" in which vendor V is the assignee of the optional task 3 with status "to do"',
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          const vendor = await cast.create("vnd", "vendor");
          const { tasks: templateTasks } = await currentTemplate(TENANT_MOVE_IN);
          const task3 = templateTasks[2];
          expect(task3.isRequired).toBe(false);
          task3Name = task3.name;
          runId = await launchAs(manager, TENANT_MOVE_IN, APARTMENT_12, { [task3.id]: vendor.id });
          await completeRequired(manager, runId);
          await signInAs(page, vendor);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 1 done");
        },
      );

      await when("V marks task 3 as done", async () => {
        const row = page.getByTestId("run-task").filter({ hasText: task3Name });
        await row.getByRole("button", { name: "Mark as done" }).click();
        await expect(row.getByTestId("task-status")).toHaveText("done");
      });

      await thenStep(
        page,
        {
          clause: 'task 3 has status "done", V sees "Your tasks: 1 of 1 done" (the run page).',
          visible: [`задача 3 «${task3Name}» (optional) зі статусом «done»`, "«Your tasks: 1 of 1 done»"],
          hidden: ["статусу запуску на сторінці вендора немає (AC-VENDOR-11) — він на наступному кадрі, у списку запусків"],
        },
        async () => {
          await expect(page.getByTestId("run-task").filter({ hasText: task3Name }).getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 1 done");
        },
      );

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });

      await thenStep(
        page,
        {
          clause: 'the run stays "completed" (the list of runs), and V still sees "Your tasks: 1 of 1 done".',
          visible: ["рядок «Apartment 12, move-in» зі статусом «completed»", "«Your tasks: 1 of 1 done»"],
          hidden: ["у базі запуск «completed», задача 3 «done»"],
        },
        async () => {
          const row = page.getByTestId("run-row").filter({ hasText: APARTMENT_12 });
          await expect(row.getByText("completed", { exact: true })).toBeVisible();
          await expect(row.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 1 done");
          expect((await runTasks(runId)).find((task) => task.name === task3Name)?.status).toBe("done");
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
