// AC-VENDOR-03, 04, 05, 06, 10, 11, 12, 13 — що вендор бачить і що робить у своїх запусках (зріз 3 і уточнення 10.11). Пишуть дані: створюють
// синтетичних користувачів uat-<run>-…@example.test і запуски (через справжню launch_run від імені менеджера),
// а по собі прибирають (Cast.dispose). Тег @writes: на проді — лише з синтетичними користувачами й прибиранням.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  APARTMENT_14,
  Cast,
  REPAIR_REQUEST,
  TENANT_MOVE_IN,
  clientFor,
  currentTemplate,
  launchApartment12,
  launchAs,
  runTasks,
  signInAs,
  type Actor,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-VENDOR-03: вендор V із двома задачами в «Apartment 12, move-in» і без задач в «Apartment 14, repair» бачить у списку лише перший запуск, його статус і «Your tasks: 0 of 2 done»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-03" } },
  async ({ page }) => {
    const cast = new Cast("v03");
    try {
      let vendor!: Actor;
      await given(
        "vendor V who is the assignee of 2 tasks in the run \"Apartment 12, move-in\" and of no task in the run \"Apartment 14, repair\"",
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          vendor = await cast.create("vnd", "vendor");
          const { tasks } = await launchApartment12(manager, vendor);
          expect(tasks.filter((task) => task.assigneeId === vendor.id)).toHaveLength(2);
          const repairId = await launchAs(manager, REPAIR_REQUEST, APARTMENT_14);
          expect((await runTasks(repairId)).filter((task) => task.assigneeId === vendor.id)).toHaveLength(0);
          await signInAs(page, vendor);
        },
      );

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
        await expect(page.getByRole("heading", { level: 1, name: "Runs" })).toBeVisible();
      });

      await thenStep(
        page,
        {
          clause:
            "V sees only the run \"Apartment 12, move-in\" with its run status and \"Your tasks: 0 of 2 done\", and does not see \"Apartment 14, repair\".",
          visible: [
            "рівно один рядок списку: запуск «Apartment 12, move-in»",
            "статус запуску «in progress» у цьому рядку",
            "«Your tasks: 0 of 2 done» у цьому рядку",
          ],
          hidden: ["«Apartment 14, repair» ніде на сторінці немає, і рядка такого запуску в списку немає"],
        },
        async () => {
          const rows = page.getByTestId("run-row");
          await expect(rows).toHaveCount(1);
          await expect(rows.first().getByRole("link", { name: APARTMENT_12, exact: true })).toBeVisible();
          await expect(rows.first().getByText("in progress", { exact: true })).toBeVisible();
          await expect(rows.first().getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 2 done");
          await expect(page.getByText(APARTMENT_14)).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-04: вендор V відкриває «Apartment 12, move-in» (5 задач) і бачить рівно задачі 3 і 4 — назва, розділ, «required» чи «optional» і статус, без чужих задач, email інших користувачів і прогресу всього запуску",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-04" } },
  async ({ page }) => {
    const cast = new Cast("v04");
    try {
      let manager!: Actor;
      let vendor!: Actor;
      let template: Awaited<ReturnType<typeof currentTemplate>>;

      await given(
        "vendor V who is the assignee of tasks 3 and 4 in the run \"Apartment 12, move-in\" (5 tasks)",
        async () => {
          manager = await cast.create("mgr-a", "manager");
          vendor = await cast.create("vnd", "vendor");
          template = await currentTemplate(TENANT_MOVE_IN);
          const { tasks } = await launchApartment12(manager, vendor);
          expect(tasks).toHaveLength(5);
          await signInAs(page, vendor);
          await page.goto("/runs");
        },
      );

      await when("V opens this run", async () => {
        await page.getByRole("link", { name: APARTMENT_12, exact: true }).click();
        await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
      });

      await thenStep(
        page,
        {
          clause:
            "V sees exactly tasks 3 and 4, each with its name, its section, the mark \"required\" or \"optional\" and its status, and does not see tasks 1, 2 and 5, the emails of other users or the progress of the whole run.",
          visible: [
            "рівно дві задачі",
            "задача 3 «Order cleaning» у розділі «Before move-in», позначка «optional», статус «to do»",
            "задача 4 «Hand over the keys» у розділі «Move-in day», позначка «required», статус «to do»",
          ],
          hidden: [
            "назв задач 1, 2 і 5 («Sign the lease», «Collect the deposit», «Record meter readings») на сторінці немає",
            "email менеджера A (чужого користувача) на сторінці немає, жодного іншого email у списку задач теж",
            "прогресу всього запуску («… of 5 done», підпису «Progress») на сторінці немає",
          ],
        },
        async () => {
          const [task1, task2, task3, task4, task5] = template.tasks;
          const rows = page.getByTestId("run-task");
          await expect(rows).toHaveCount(2);
          await expect(page.getByRole("heading", { level: 2 })).toHaveText([task3.sectionName, task4.sectionName]);
          await expect(rows.nth(0)).toContainText(task3.name);
          await expect(rows.nth(0)).toContainText("(optional)");
          await expect(rows.nth(0).getByTestId("task-status")).toHaveText("to do");
          await expect(rows.nth(1)).toContainText(task4.name);
          await expect(rows.nth(1)).toContainText("(required)");
          await expect(rows.nth(1).getByTestId("task-status")).toHaveText("to do");

          for (const other of [task1, task2, task5]) {
            await expect(page.locator("body")).not.toContainText(other.name);
          }
          await expect(page.locator("body")).not.toContainText(manager.email);
          await expect(rows.getByText(/@example\.test/)).toHaveCount(0);
          await expect(page.getByTestId("run-progress")).toHaveCount(0);
          await expect(page.getByText(/of 5 done/)).toHaveCount(0);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-05: вендор V позначає виконаною свою задачу 3 (не остання обов'язкова) — вона «done», а V бачить «Your tasks: 1 of 2 done»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-05" } },
  async ({ page }) => {
    const cast = new Cast("v05");
    try {
      let runId = "";
      let vendor!: Actor;
      let template: Awaited<ReturnType<typeof currentTemplate>>;

      await given(
        "vendor V who is the assignee of task 3 with status \"to do\", which is not the last required task of the run \"Apartment 12, move-in\"",
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          vendor = await cast.create("vnd", "vendor");
          template = await currentTemplate(TENANT_MOVE_IN);
          const launched = await launchApartment12(manager, vendor);
          runId = launched.runId;
          const [task1, task2, task3, task4] = launched.tasks;
          expect(task3).toMatchObject({ assigneeId: vendor.id, status: "to_do" });
          // Обов'язкові задачі 1, 2 (A) і 4 (V) ще «to do»: задача 3 не остання обов'язкова (вона й необов'язкова).
          expect([task1, task2, task4].every((task) => task.isRequired && task.status === "to_do")).toBe(true);
          await signInAs(page, vendor);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("run-task")).toHaveCount(2);
        },
      );

      await when("V marks task 3 as done", async () => {
        const row = page.getByTestId("run-task").filter({ hasText: template.tasks[2].name });
        await row.getByRole("button", { name: "Mark as done" }).click();
      });

      await thenStep(
        page,
        {
          clause: "task 3 has status \"done\", and V sees \"Your tasks: 1 of 2 done\".",
          visible: ["задача 3 «Order cleaning» зі статусом «done»", "«Your tasks: 1 of 2 done» на сторінці запуску"],
          hidden: [
            "підтвердження («This cannot be undone») не просили: задача 3 не остання обов'язкова",
            "задача 4 вендора на екрані лишилась «to do»",
            "у базі задача 3 — done, а задачі 1, 2, 4 і 5 — to do",
          ],
        },
        async () => {
          const row = page.getByTestId("run-task").filter({ hasText: template.tasks[2].name });
          await expect(row.getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 2 done");

          await expect(page.getByText("This cannot be undone")).toHaveCount(0);
          const keys = page.getByTestId("run-task").filter({ hasText: template.tasks[3].name });
          await expect(keys.getByTestId("task-status")).toHaveText("to do");
          expect((await runTasks(runId)).map((task) => task.status)).toEqual(["to_do", "to_do", "done", "to_do", "to_do"]);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-06: вендор V за прямим посиланням на «Apartment 14, repair», де в нього немає задач, бачить «Run not found» і жодної задачі запуску",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-06" } },
  async ({ page }) => {
    const cast = new Cast("v06");
    try {
      let repairId = "";
      let repairTaskNames: string[] = [];

      await given("the run \"Apartment 14, repair\" in which vendor V has no task", async () => {
        const manager = await cast.create("mgr-a", "manager");
        const vendor = await cast.create("vnd", "vendor");
        // У V є задачі в іншому запуску: він справжній виконавець, але не цього запуску.
        await launchApartment12(manager, vendor);
        repairId = await launchAs(manager, REPAIR_REQUEST, APARTMENT_14);
        const repairTasks = await runTasks(repairId);
        expect(repairTasks.filter((task) => task.assigneeId === vendor.id)).toHaveLength(0);
        repairTaskNames = repairTasks.map((task) => task.name);
        await signInAs(page, vendor);
      });

      await when("V opens the page of this run by a direct link", async () => {
        await page.goto(`/runs/${repairId}`);
      });

      await thenStep(
        page,
        {
          clause: "V sees the message \"Run not found\" and none of the tasks of the run.",
          visible: ["заголовок-повідомлення «Run not found»", "посилання «Back to runs»"],
          hidden: [
            "жодної задачі запуску: рядків задач немає, назв задач «Apartment 14, repair» на сторінці немає",
            "назви випадку «Apartment 14, repair» на сторінці немає",
            "адреса лишилась прямим посиланням на запуск (відмова на тому самому місці)",
          ],
        },
        async () => {
          await expect(page).toHaveURL((url) => url.pathname === `/runs/${repairId}`);
          await expect(page.getByRole("heading", { level: 1, name: "Run not found" })).toBeVisible();
          await expect(page.getByRole("link", { name: "Back to runs" })).toBeVisible();
          await expect(page.getByTestId("run-task")).toHaveCount(0);
          expect(repairTaskNames).toHaveLength(4);
          for (const name of repairTaskNames) await expect(page.locator("body")).not.toContainText(name);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-10: вендор V, якому не призначено жодної задачі, відкриває список запусків і бачить «No tasks assigned to you yet.» без порожньої таблиці",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-10" } },
  async ({ page }) => {
    const cast = new Cast("v10");
    try {
      await given("vendor V to whom no task is assigned", async () => {
        const manager = await cast.create("mgr-a", "manager");
        const vendor = await cast.create("vnd", "vendor");
        // Запуск іншого менеджера без жодної задачі V існує, але до V не стосується.
        const runId = await launchAs(manager, REPAIR_REQUEST, APARTMENT_14);
        expect((await runTasks(runId)).filter((task) => task.assigneeId === vendor.id)).toHaveLength(0);
        await signInAs(page, vendor);
      });

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
        await expect(page.getByRole("heading", { level: 1, name: "Runs" })).toBeVisible();
      });

      await thenStep(
        page,
        {
          clause: "V sees the message \"No tasks assigned to you yet.\" and no empty table.",
          visible: ["повідомлення «No tasks assigned to you yet.»"],
          hidden: [
            "порожньої таблиці немає: на сторінці немає жодної таблиці й жодного рядка запуску",
            "чужого запуску «Apartment 14, repair» немає",
          ],
        },
        async () => {
          await expect(page.getByText("No tasks assigned to you yet.", { exact: true })).toBeVisible();
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByTestId("run-row")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-11: вендор V із задачами 3 («done») і 4 («to do») відкриває «Apartment 12, move-in» — заголовок сторінки — назва випадку, «Your tasks: 1 of 2 done», без статусу запуску, назви й версії шаблону",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-11" } },
  async ({ page }) => {
    const cast = new Cast("v11");
    try {
      let runId = "";
      await given(
        'vendor V who is the assignee of tasks 3 ("done") and 4 ("to do") in the run "Apartment 12, move-in" (5 tasks)',
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          const vendor = await cast.create("vnd", "vendor");
          const launched = await launchApartment12(manager, vendor);
          runId = launched.runId;
          const own = launched.tasks.filter((task) => task.assigneeId === vendor.id);
          // Задачу 3 V позначає сам — справжньою функцією бази з його сесією.
          const { error } = await (await clientFor(vendor)).rpc("mark_task_done", { p_task_id: own[0].id, p_confirmed: false });
          expect(error).toBeNull();
          expect((await runTasks(runId)).map((task) => task.status)).toEqual(["to_do", "to_do", "done", "to_do", "to_do"]);
          await signInAs(page, vendor);
        },
      );

      await when("V opens this run", async () => {
        await page.goto(`/runs/${runId}`);
      });

      await thenStep(
        page,
        {
          clause:
            'V sees the case name "Apartment 12, move-in" as the title of the page and "Your tasks: 1 of 2 done", and does not see the run status, the template name or the template version.',
          visible: ["заголовок сторінки (h1) — «Apartment 12, move-in»", "«Your tasks: 1 of 2 done» під заголовком"],
          hidden: [
            "статусу запуску («in progress» / «completed») на сторінці немає",
            "назви шаблону «Tenant move-in» і «Template version …» на сторінці немає",
          ],
        },
        async () => {
          const main = page.getByRole("main");
          await expect(main.getByRole("heading", { level: 1 })).toHaveText(APARTMENT_12);
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 2 done");
          await expect(main.getByText("in progress", { exact: true })).toHaveCount(0);
          await expect(main.getByText("completed", { exact: true })).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText("Tenant move-in");
          await expect(page.getByTestId("template-version")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText("Template version");
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-12: вендор V відкриває список запусків — рядок «Apartment 12, move-in» показує назву випадку, статус запуску й «Your tasks: 0 of 2 done», без назви шаблону «Tenant move-in»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-12" } },
  async ({ page }) => {
    const cast = new Cast("v12");
    try {
      await given(
        'vendor V who is the assignee of 2 tasks in the run "Apartment 12, move-in", launched from the template "Tenant move-in"',
        async () => {
          const manager = await cast.create("mgr-a", "manager");
          const vendor = await cast.create("vnd", "vendor");
          await launchApartment12(manager, vendor);
          await signInAs(page, vendor);
        },
      );

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });

      await thenStep(
        page,
        {
          clause:
            'the row of this run shows the case name, the run status and "Your tasks: 0 of 2 done", and does not show the template name "Tenant move-in".',
          visible: ["у рядку — назва випадку «Apartment 12, move-in»", "статус «in progress»", "«Your tasks: 0 of 2 done»"],
          hidden: ["назви шаблону «Tenant move-in» у рядку й на сторінці немає, як і колонки «Template»"],
        },
        async () => {
          const row = page.getByTestId("run-row").first();
          await expect(page.getByTestId("run-row")).toHaveCount(1);
          await expect(row.getByRole("link", { name: APARTMENT_12, exact: true })).toBeVisible();
          await expect(row.getByText("in progress", { exact: true })).toBeVisible();
          await expect(row.getByTestId("your-tasks")).toHaveText("Your tasks: 0 of 2 done");
          await expect(row).not.toContainText("Tenant move-in");
          await expect(page.locator("body")).not.toContainText("Tenant move-in");
          await expect(page.getByRole("columnheader", { name: "Template" })).toHaveCount(0);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-13: вендор V входить — бачить список запусків, а навігація показує лише «Runs» і «Profile»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-13" } },
  async ({ page }) => {
    const cast = new Cast("v13");
    try {
      let vendor!: Actor;
      await given('vendor V who is the assignee of 2 tasks in the run "Apartment 12, move-in"', async () => {
        const manager = await cast.create("mgr-a", "manager");
        vendor = await cast.create("vnd", "vendor");
        await launchApartment12(manager, vendor);
      });

      await when("V signs in", async () => {
        // Звичайний вхід через форму (без прямого посилання): signInAs далі відкриває «/», тож тут — вручну.
        await page.goto("/login");
        await page.getByLabel("Email").fill(vendor.email);
        await page.getByLabel("Password").evaluate((el, value) => {
          (el as HTMLInputElement).value = value;
        }, vendor.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL((url) => url.pathname === "/runs");
      });

      await thenStep(
        page,
        {
          clause: 'V sees the list of runs, and the navigation shows only "Runs" and "Profile".',
          visible: ["сторінка «Runs» зі запуском «Apartment 12, move-in»", "у навігації рівно два пункти: «Runs» і «Profile»"],
          hidden: ["пункту «Templates» у навігації немає"],
        },
        async () => {
          await expect(page.getByRole("heading", { level: 1, name: "Runs" })).toBeVisible();
          await expect(page.getByTestId("run-row").first().getByRole("link", { name: APARTMENT_12, exact: true })).toBeVisible();
          const nav = page.getByRole("navigation", { name: "Main" });
          await expect(nav.getByRole("link")).toHaveText(["Runs", "Profile"]);
          await expect(nav.getByRole("link", { name: "Templates" })).toHaveCount(0);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
