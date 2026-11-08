// AC-VENDOR-07, 08, 09 — відмови для вендора (зріз 3): чужу задачу не позначити, шаблонів не бачити, шаблон не
// запустити — ні на сторінках, ні прямим запитом. «Прямий запит» тут — справжні виклики Supabase REST/RPC із сесією
// самого вендора (publishable-ключ, мінуючи сторінки застосунку); після них відмову видно на екрані. Пишуть дані:
// власні синтетичні користувачі uat-<run>-…@example.test й запуски, прибирання — Cast.dispose. Тег @writes.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  Cast,
  TENANT_MOVE_IN,
  clientFor,
  countRuns,
  currentTemplate,
  launchApartment12,
  runTasks,
  signInAs,
  type Actor,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-VENDOR-07: вендор V прямим запитом, в обхід сторінок, позначає задачу 1 менеджера A — відмова, задача 1 лишається «to do»",
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
          // Свідок результату — менеджер A: вендор чужу задачу не бачить, а A бачить її статус на сторінці запуску.
          await signInAs(page, manager);
          await page.goto(`/runs/${runId}`);
          await expect(page.getByTestId("run-task").first().getByTestId("task-status")).toHaveText("to do");
        },
      );

      await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
        const vendorClient = await clientFor(vendor);
        // Функція бази, яку викликає й сторінка запуску, — але прямим запитом із сесією V і з підтвердженням.
        const rpc = await vendorClient.rpc("mark_task_done", { p_task_id: taskOneId, p_confirmed: true });
        rpcMessage = rpc.error?.message;
        // І прямий запис у таблицю задач.
        const update = await vendorClient.from("run_tasks").update({ status: "done" }).eq("id", taskOneId).select();
        updateRows = update.data ?? [];
        await page.reload();
      });

      await thenStep(
        page,
        {
          clause: "task 1 stays \"to do\".",
          visible: [
            "на сторінці запуску менеджера A задача 1 «Sign the lease» зі статусом «to do»",
            "прогрес запуску «0 of 5 done»",
          ],
          hidden: [
            "запит через mark_task_done відхилено (NOT_ALLOWED), а не виконано",
            "прямий UPDATE run_tasks не змінив жодного рядка",
            "у базі всі п'ять задач запуску лишились «to_do»",
          ],
        },
        async () => {
          const first = page.getByTestId("run-task").first();
          await expect(first).toContainText(taskOneName);
          await expect(first.getByTestId("task-status")).toHaveText("to do");
          await expect(page.getByTestId("run-progress")).toHaveText("0 of 5 done");

          expect(rpcMessage).toContain("NOT_ALLOWED");
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
  "AC-VENDOR-08: вендор V за прямим посиланням на список шаблонів бачить «Not enough rights» і жодного шаблону",
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
          clause: "V sees the message \"Not enough rights\" and no template.",
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
      let insertRows: unknown[] = [];

      await given("vendor V signed in and the template \"Tenant move-in\" with a current version", async () => {
        const manager = await cast.create("mgr-a", "manager");
        vendor = await cast.create("vnd", "vendor");
        // «Current version 1» з AC: на цьому стеку поточна версія — та, що збережена в шаблоні (на проді після
        // AC-EDITOR-07 це вже 2); важливо, що шаблон збережено й адміністратор чи менеджер його запустили б.
        ({ version } = await currentTemplate(TENANT_MOVE_IN));
        expect(version).toBeGreaterThanOrEqual(1);
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
