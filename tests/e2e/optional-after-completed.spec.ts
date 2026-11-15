// AC-TASK-19, AC-VENDOR-16 — необов'язкову задачу запуску «completed» її виконавець ще може позначити виконаною: запуск
// лишається «completed», прогрес (і «Your tasks» вендора) її рахує (рішення PM solomchaak/property-workflows-spec#46).
// Пишуть дані: синтетичні користувачі uat-<run>-…@example.test і запуски через справжню launch_run; прибирання —
// Cast.dispose. Тег @writes.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  APARTMENT_14,
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

/** Назва необов'язкової задачі — дослівно з AC-TASK-19. */
const ORDER_A_PART = "Order a part";

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
      let total = 0;
      let required = 0;

      await given(
        `a run with status "completed" that has the optional task "${ORDER_A_PART}" with status "to do", and the assignee of this task`,
        async () => {
          // «Order a part» у шаблонах проду немає, тож «Дано» відтворює синтетичний шаблон: версія 1, збережена
          // справжньою save_template_version (рев'ю WS9, koldovsky/2026-quitcode-09-software-factory-hw#9).
          const admin = await cast.create("adm", "admin");
          const manager = await cast.create("mgr-a", "manager");
          const assignee = await cast.create("mgr-b", "manager");
          const template = await cast.template(admin, "tpl", [
            {
              name: "Repair",
              tasks: [
                { name: "Inspect the boiler", isRequired: true },
                { name: "Fix the leak", isRequired: true },
                { name: ORDER_A_PART, isRequired: false },
              ],
            },
          ]);
          expect(template.version).toBe(1);
          const optional = template.tasks.find((task) => task.name === ORDER_A_PART)!;
          expect(optional.isRequired).toBe(false);
          runId = await launchAs(manager, template.id, APARTMENT_14, { [optional.id]: assignee.id });
          await completeRequired(manager, runId);
          const tasks = await runTasks(runId);
          total = tasks.length;
          required = tasks.filter((task) => task.isRequired).length;
          const task = tasks.find((candidate) => candidate.name === ORDER_A_PART);
          expect(task?.status).toBe("to_do");
          expect(task?.assigneeId).toBe(assignee.id);
          await signInAs(page, assignee);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("run-status")).toHaveText("completed");
          await expect(page.getByTestId("run-progress")).toHaveText(`${required} of ${total} done`);
          await expect(page.getByTestId("run-task").filter({ hasText: ORDER_A_PART }).getByTestId("task-status")).toHaveText(
            "to do",
          );
        },
      );

      await when(`the assignee marks "${ORDER_A_PART}" as done`, async () => {
        const row = page.getByTestId("run-task").filter({ hasText: ORDER_A_PART });
        await row.getByRole("button", { name: "Mark as done" }).click();
        await expect(row.getByTestId("task-status")).toHaveText("done");
      });

      // «Visible» — лише те, що видно на кадрі; стан до дії перевірено в «Дано» (hidden).
      await thenStep(
        page,
        {
          clause: 'the task has status "done", the run stays "completed", and the progress counts the task as done.',
          visible: [
            `задача «${ORDER_A_PART}» (optional) зі статусом «done»`,
            "статус запуску «completed»",
            `прогрес «${required + 1} of ${total} done»`,
          ],
          hidden: [
            `до дії прогрес був «${required} of ${total} done», а задача — «to do» (перевірено в «Дано»)`,
            "шаблон із задачею — синтетичний, версія 1 (save_template_version)",
            "у базі задача «done», запуск «completed»",
          ],
        },
        async () => {
          await expect(page.getByTestId("run-task").filter({ hasText: ORDER_A_PART }).getByTestId("task-status")).toHaveText(
            "done",
          );
          await expect(page.getByTestId("run-status")).toHaveText("completed");
          await expect(page.getByTestId("run-progress")).toHaveText(`${required + 1} of ${total} done`);
          expect((await runTasks(runId)).find((task) => task.name === ORDER_A_PART)?.status).toBe("done");
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
          // clause — дослівна частина «Тоді» AC-VENDOR-16; де саме це видно — у visible.
          clause: 'task 3 has status "done", V sees "Your tasks: 1 of 1 done",',
          visible: [
            `сторінка запуску V: задача 3 «${task3Name}» (optional) зі статусом «done»`,
            "сторінка запуску V: «Your tasks: 1 of 1 done»",
          ],
          hidden: ["статусу запуску на сторінці вендора немає (AC-VENDOR-11) — він на наступному кадрі, у списку запусків"],
        },
        async () => {
          await expect(page.getByTestId("run-task").filter({ hasText: task3Name }).getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 1 done");
          const main = page.getByRole("main");
          await expect(main.getByText("completed", { exact: true })).toHaveCount(0);
          await expect(main.getByText("in progress", { exact: true })).toHaveCount(0);
        },
      );

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });

      await thenStep(
        page,
        {
          clause: 'and the run stays "completed".',
          visible: [
            "список запусків V: рядок «Apartment 12, move-in» зі статусом «completed»",
            "той самий рядок: «Your tasks: 1 of 1 done»",
          ],
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
