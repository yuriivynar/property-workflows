// AC-VENDOR-07, 08, 09, 14, 15 — відмови для вендора (зріз 3 і уточнення 10.11): чужу задачу не позначити, шаблонів
// не бачити, шаблон не запустити — ні на сторінках, ні прямим запитом. «Прямий запит» тут — справжні виклики Supabase REST/RPC із сесією
// самого вендора (publishable-ключ, мінуючи сторінки застосунку); після них відмову видно на екрані. Пишуть дані:
// власні синтетичні користувачі uat-<run>-…@example.test й запуски, прибирання — Cast.dispose. Тег @writes.
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  APARTMENT_14,
  Cast,
  REPAIR_REQUEST,
  TENANT_MOVE_IN,
  clientFor,
  countRuns,
  currentTemplate,
  launchApartment12,
  launchAs,
  runTasks,
  signInAs,
  type Actor,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/**
 * «В обхід сторінок» через саму дію позначки: вендор на сторінці свого запуску підмінює приховані поля форми своєї
 * задачі (run_id, task_id) і надсилає її — як запит, зібраний вручну. Сторінка показує відповідь дії.
 */
async function submitMarkDoneFor(page: Page, target: { runId: string; taskId: string }) {
  const form = page.getByTestId("run-task").first().locator("form");
  await form.locator('input[name="run_id"]').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, target.runId);
  await form.locator('input[name="task_id"]').evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, target.taskId);
  await form.getByRole("button", { name: "Mark as done" }).click();
  await page.waitForURL(
    (url) => url.pathname === `/runs/${target.runId}` && url.searchParams.get("error") === "NOT_ALLOWED",
  );
}

test(
  "AC-VENDOR-07: вендор V прямим запитом, в обхід сторінок, позначає задачу 1 менеджера A — відмова, задача 1 лишається «to do», V бачить текст AC-TASK-03",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-07" } },
  async ({ page }) => {
    const cast = new Cast("v07");
    try {
      let manager!: Actor;
      let vendor!: Actor;
      let runId = "";
      let taskOneId = "";
      let taskOneName = "";
      let rpcMessage: string | undefined;
      let updateErrorCode: string | undefined;
      let updateRows: unknown[] = [];

      await given(
        "the run \"Apartment 12, move-in\" in which task 1 is assigned to manager A and tasks 3 and 4 to vendor V",
        async () => {
          manager = await cast.create("mgr-a", "manager");
          vendor = await cast.create("vnd", "vendor");
          const launched = await launchApartment12(manager, vendor);
          runId = launched.runId;
          const [task1] = launched.tasks;
          taskOneId = task1.id;
          taskOneName = task1.name;
          expect(task1).toMatchObject({ assigneeId: manager.id, status: "to_do" });
          await signInAs(page, vendor);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("run-task")).toHaveCount(2);
        },
      );

      await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
        const vendorClient = await clientFor(vendor);
        // Функція бази, яку викликає й сторінка запуску, — але прямим запитом із сесією V і з підтвердженням.
        const rpc = await vendorClient.rpc("mark_task_done", { p_task_id: taskOneId, p_confirmed: true });
        rpcMessage = rpc.error?.message;
        // І прямий запис у таблицю задач.
        const update = await vendorClient.from("run_tasks").update({ status: "done" }).eq("id", taskOneId).select();
        updateErrorCode = update.error?.code;
        updateRows = update.data ?? [];
        // І дія позначки сторінки — з id задачі 1, підміненим у формі своєї задачі 3.
        await submitMarkDoneFor(page, { runId, taskId: taskOneId });
      });

      await thenStep(
        page,
        {
          clause:
            "task 1 stays \"to do\", and V gets the message \"Only the task's assignee, the run manager, or an administrator can mark a task as done\".",
          visible: [
            "на сторінці запуску V повідомлення «Only the task's assignee, the run manager, or an administrator can mark a task as done»",
            "V і далі бачить лише свої задачі 3 і 4 — задачі 1 на сторінці немає",
          ],
          hidden: [
            "запит через mark_task_done відхилено (NOT_ALLOWED), а не виконано",
            "прямий UPDATE run_tasks не змінив жодного рядка",
            "у базі всі п'ять задач запуску лишились «to_do»",
          ],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("alert")).toHaveText(
            "Only the task's assignee, the run manager, or an administrator can mark a task as done",
          );
          await expect(page.getByTestId("run-task")).toHaveCount(2);
          await expect(page.getByRole("main")).not.toContainText(taskOneName);

          expect(rpcMessage).toContain("NOT_ALLOWED");
          // Прямий запис або відхилено правами (42501), або відфільтровано RLS без помилки; інша помилка (мережа) — не доказ.
          expect(updateErrorCode ?? "42501").toBe("42501");
          expect(updateRows).toHaveLength(0);
          expect((await runTasks(runId)).map((task) => task.status)).toEqual(["to_do", "to_do", "to_do", "to_do", "to_do"]);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-08: вендор V за прямим посиланням на список шаблонів бачить «Not enough rights», посилання «Back to runs» і жодного шаблону",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-08" } },
  async ({ page }) => {
    const cast = new Cast("v08");
    try {
      await given("vendor V signed in", async () => {
        const vendor = await cast.create("vnd", "vendor");
        await signInAs(page, vendor);
      });

      await when("V opens the list of templates by a direct link", async () => {
        await page.goto("/templates");
      });

      await thenStep(
        page,
        {
          clause: "V sees the message \"Not enough rights\" and the link \"Back to runs\", and no template.",
          visible: ["повідомлення «Not enough rights»", "посилання «Back to runs»"],
          hidden: [
            "жодного шаблону: на сторінці немає таблиці й рядків шаблонів",
            "назв довідкових шаблонів «Tenant move-in» і «Repair request» на сторінці немає",
            "адреса лишилась списком шаблонів (відмова на тому самому місці, а не перехід)",
          ],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === "/templates");
          const notice = page.getByRole("main").getByRole("status");
          await expect(notice.getByRole("heading", { level: 1 })).toHaveText("Not enough rights");
          await expect(notice.getByRole("link", { name: "Back to runs" })).toBeVisible();
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByTestId("template-row")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText("Tenant move-in");
          await expect(page.locator("body")).not.toContainText("Repair request");
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-09: вендор V прямим запитом, в обхід сторінок, запускає «Tenant move-in» — запуск не створено, список запусків не змінився",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-09" } },
  async ({ page }) => {
    const cast = new Cast("v09");
    // Назва спроби відрізняється від «Apartment 12, move-in» запуску з «Дано»: за нею видно, що нового запуску немає.
    const attemptName = "Apartment 16, move-in";
    try {
      let vendor!: Actor;
      let version = 0;
      let before: string[] = [];
      let launchMessage: string | undefined;
      let insertErrorCode: string | undefined;
      let insertRows: unknown[] = [];

      await given("vendor V signed in and the template \"Tenant move-in\" with a current version", async () => {
        const manager = await cast.create("mgr-a", "manager");
        vendor = await cast.create("vnd", "vendor");
        // «Current version 1» з AC: поточну версію читаємо з бази (currentTemplate кидає виняток, якщо шаблон ніколи не
        // зберігали). На проді й у CI після фікстури AC-EDITOR-07 вона 2, а не 1 — це відхилення «Дано» від тексту AC
        // описано в docs/qa/proof-pack.md; «Тоді» (запуск не створено) від версії не залежить.
        ({ version } = await currentTemplate(TENANT_MOVE_IN));
        // У V є один запуск зі своєю задачею — щоб «список запусків не змінився» означало щось більше за порожній список.
        await launchApartment12(manager, vendor);
        await signInAs(page, vendor);
        await page.goto("/runs");
        const rows = page.getByTestId("run-row");
        await expect(rows).toHaveCount(1);
        before = await rows.allTextContents();
      });

      await when("V tries to launch this template directly, bypassing the pages of the application", async () => {
        const vendorClient = await clientFor(vendor);
        const launch = await vendorClient.rpc("launch_run", {
          p_template_id: TENANT_MOVE_IN,
          p_case_name: attemptName,
          p_assignments: {},
        });
        launchMessage = launch.error?.message;
        // І прямий запис у таблицю запусків.
        const insert = await vendorClient
          .from("runs")
          .insert({
            template_id: TENANT_MOVE_IN,
            template_name: "Tenant move-in",
            template_version: version,
            case_name: attemptName,
            run_manager_id: vendor.id,
          })
          .select();
        insertErrorCode = insert.error?.code;
        insertRows = insert.data ?? [];
        await page.goto("/runs");
      });

      await thenStep(
        page,
        {
          clause: "no run is created, and the list of runs does not change.",
          visible: [
            "список запусків V — той самий єдиний рядок «Apartment 12, move-in» зі «Your tasks: 0 of 2 done»",
            "запуску «Apartment 16, move-in» (спроби) у списку немає",
          ],
          hidden: [
            "запит через launch_run відхилено (LAUNCH_NOT_ALLOWED), а не виконано",
            "прямий INSERT у runs не створив жодного рядка",
            "у базі немає запуску з менеджером V і немає запуску з назвою спроби",
          ],
        },
        async () => {
          const rows = page.getByTestId("run-row");
          await expect(rows).toHaveCount(1);
          await expect(rows).toHaveText(before);
          await expect(rows.first().getByRole("link", { name: APARTMENT_12, exact: true })).toBeVisible();
          await expect(rows.first().getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 2 done");
          await expect(page.locator("body")).not.toContainText(attemptName);

          expect(launchMessage).toContain("LAUNCH_NOT_ALLOWED");
          expect(insertErrorCode).toBe("42501");
          expect(insertRows).toHaveLength(0);
          expect(await countRuns({ runManagerId: vendor.id })).toBe(0);
          expect(await countRuns({ caseName: attemptName })).toBe(0);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-14: вендор V за прямим посиланням на форму запуску, сторінку шаблону, список версій і редактор бачить «Not enough rights» і «Back to runs», без вмісту шаблону",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-14" } },
  async ({ page }) => {
    const cast = new Cast("v14");
    const targets = [
      { name: "the launch form", path: `/runs/new?template=${TENANT_MOVE_IN}` },
      { name: "the page of a template", path: `/templates/${TENANT_MOVE_IN}` },
      { name: "the list of versions", path: `/templates/${TENANT_MOVE_IN}/versions` },
      { name: "the editor", path: `/templates/${TENANT_MOVE_IN}/edit` },
    ];
    try {
      let taskNames: string[] = [];
      await given("vendor V signed in", async () => {
        const vendor = await cast.create("vnd", "vendor");
        taskNames = (await currentTemplate(TENANT_MOVE_IN)).tasks.map((task) => task.name);
        await signInAs(page, vendor);
      });

      for (const target of targets) {
        await when(`V opens ${target.name} by a direct link`, async () => {
          await page.goto(target.path);
        });

        await thenStep(
          page,
          {
            clause: `V sees the message "Not enough rights" and the link "Back to runs", and no content of the template (${target.name}).`,
            visible: ["повідомлення «Not enough rights»", "посилання «Back to runs» веде на /runs"],
            hidden: [
              "посилання «Back to templates» немає",
              "назви шаблону «Tenant move-in» і назв його задач на сторінці немає",
              "жодної форми й таблиці",
            ],
          },
          async () => {
            const main = page.getByRole("main");
            const notice = main.getByRole("status");
            await expect(notice.getByRole("heading", { level: 1 })).toHaveText("Not enough rights");
            await expect(notice.getByRole("link", { name: "Back to runs" })).toHaveAttribute("href", "/runs");
            await expect(main.getByRole("link", { name: "Back to templates" })).toHaveCount(0);
            await expect(main).not.toContainText("Tenant move-in");
            for (const name of taskNames) await expect(main).not.toContainText(name);
            await expect(main.locator("form, table")).toHaveCount(0);
          },
        );
      }
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-15: вендор V прямим запитом, в обхід сторінок, позначає задачу 1 менеджера A в «Apartment 14, repair», де в нього немає задач — задача 1 лишається «to do», V бачить лише «Run not found»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-15" } },
  async ({ page }) => {
    const cast = new Cast("v15");
    try {
      let vendor!: Actor;
      let repairId = "";
      let taskOneId = "";
      let rpcMessage: string | undefined;

      await given(
        "the run \"Apartment 14, repair\" in which vendor V has no task and task 1 is assigned to manager A",
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          vendor = await cast.create("vnd", "vendor");
          repairId = await launchAs(manager, REPAIR_REQUEST, APARTMENT_14);
          const [task1] = await runTasks(repairId);
          taskOneId = task1.id;
          expect(task1).toMatchObject({ assigneeId: manager.id, status: "to_do" });
          // Свій запуск V — лише щоб на сторінці була форма позначки, поля якої він підмінить.
          const { runId: ownRunId } = await launchApartment12(manager, vendor);
          await signInAs(page, vendor);
          await page.goto(`/runs/${ownRunId}`);
          await expect(page.getByTestId("run-task")).toHaveCount(2);
        },
      );

      await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
        const rpc = await (await clientFor(vendor)).rpc("mark_task_done", { p_task_id: taskOneId, p_confirmed: true });
        rpcMessage = rpc.error?.message;
        await submitMarkDoneFor(page, { runId: repairId, taskId: taskOneId });
      });

      await thenStep(
        page,
        {
          clause: "task 1 stays \"to do\", and V gets the message \"Run not found\".",
          visible: ["заголовок «Run not found»", "жодної задачі запуску й жодного іншого повідомлення"],
          hidden: ["запит через mark_task_done відхилено (NOT_ALLOWED)", "у базі задача 1 лишилась «to_do»"],
        },
        async () => {
          const main = page.getByRole("main");
          await expect(main.getByRole("heading", { level: 1 })).toHaveText("Run not found");
          await expect(main.getByRole("alert")).toHaveCount(0);
          await expect(main).not.toContainText("Only the task's assignee");
          await expect(page.getByTestId("run-task")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);

          expect(rpcMessage).toContain("NOT_ALLOWED");
          expect((await runTasks(repairId)).find((task) => task.id === taskOneId)?.status).toBe("to_do");
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
