// AC-VENDOR-01, AC-VENDOR-02 — менеджер призначає вендора виконавцем під час запуску шаблону (зріз 3, вимога
// «Assign a vendor and let the vendor work on their own tasks»). Пишуть дані: створюють власних синтетичних
// користувачів uat-<run>-…@example.test і запуск, а по собі прибирають (Cast.dispose). Тег @writes: на проді — лише так.
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  Cast,
  TENANT_MOVE_IN,
  clientFor,
  currentTemplate,
  runTasks,
  signInAs,
  type Actor,
  type TemplateTask,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/** Менеджер відкриває «Launch a template», обирає шаблон за назвою й бачить форму запуску (вибір виконавця — у ній). */
async function openLaunchForm(page: Page, templateName: string) {
  await page.goto("/runs/new");
  await page.getByRole("combobox", { name: "Template", exact: true }).selectOption({ label: templateName });
  await page.getByRole("button", { name: "Choose" }).click();
  await expect(page.getByLabel("Case name")).toBeVisible();
}

test(
  "AC-VENDOR-01: менеджер A запускає «Tenant move-in» для «Apartment 12, move-in» і призначає вендора V на задачі 3 і 4 — вони за V, а задачі 1, 2 і 5 за A",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-01" } },
  async ({ page }) => {
    const cast = new Cast("v01");
    try {
      let manager!: Actor;
      let vendor!: Actor;
      let tasks: TemplateTask[] = [];

      await given("manager A, vendor V and the template \"Tenant move-in\" with 5 tasks", async () => {
        manager = await cast.create("mgr-a", "manager");
        vendor = await cast.create("vnd", "vendor");
        ({ tasks } = await currentTemplate(TENANT_MOVE_IN));
        expect(tasks).toHaveLength(5);
        await signInAs(page, manager);
      });

      await when(
        "A launches the template for the case \"Apartment 12, move-in\" and assigns V as the assignee of tasks 3 and 4",
        async () => {
          await openLaunchForm(page, "Tenant move-in");
          await page.getByLabel("Case name").fill(APARTMENT_12);
          for (const task of [tasks[2], tasks[3]]) {
            await page.getByRole("combobox", { name: `Assignee of ${task.name}` }).selectOption({ label: vendor.email });
          }
          await page.getByRole("button", { name: "Launch", exact: true }).click();
          await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
        },
      );

      await thenStep(
        page,
        {
          clause: "tasks 3 and 4 have V as the assignee, and tasks 1, 2 and 5 have A.",
          visible: [
            "назва випадку «Apartment 12, move-in» на сторінці запуску",
            "у задач 3 («Order cleaning») і 4 («Hand over the keys») виконавець — email V",
            "у задач 1, 2 і 5 виконавець — email A",
          ],
          hidden: [
            "задачі 1, 2 і 5 не мають V виконавцем, а задачі 3 і 4 — A",
            "у базі виконавці збігаються з показаним (id V у задач 3 і 4, id A у решти)",
          ],
        },
        async () => {
          await expect(page.getByTestId("case-name")).toHaveText(APARTMENT_12);
          const rows = page.getByTestId("run-task");
          await expect(rows).toHaveCount(5);
          for (const index of [0, 1, 4]) {
            await expect(rows.nth(index)).toContainText(manager.email);
            await expect(rows.nth(index)).not.toContainText(vendor.email);
          }
          for (const index of [2, 3]) {
            await expect(rows.nth(index)).toContainText(vendor.email);
            await expect(rows.nth(index)).not.toContainText(manager.email);
          }
          await expect(rows.nth(2)).toContainText(tasks[2].name);
          await expect(rows.nth(3)).toContainText(tasks[3].name);

          const runId = new URL(page.url()).pathname.split("/").pop() ?? "";
          const saved = await runTasks(runId);
          expect(saved.map((task) => task.assigneeId)).toEqual([
            manager.id,
            manager.id,
            vendor.id,
            vendor.id,
            manager.id,
          ]);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-02: у виборі виконавця менеджер A бачить email менеджера B, адміністратора й вендора V — і жодних імен, ролей чи інших даних профілю",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-02" } },
  async ({ page }) => {
    const cast = new Cast("v02");
    try {
      let managerA!: Actor;
      let managerB!: Actor;
      let administrator!: Actor;
      let vendor!: Actor;

      await given("managers A and B, an administrator and vendor V, and A launching a template", async () => {
        managerA = await cast.create("mgr-a", "manager");
        managerB = await cast.create("mgr-b", "manager");
        administrator = await cast.create("adm", "admin");
        vendor = await cast.create("vnd", "vendor");
        await signInAs(page, managerA);
        await page.goto("/runs/new");
        await expect(page.getByRole("combobox", { name: "Template", exact: true })).toBeVisible();
      });

      await when("A opens the assignee picker", async () => {
        await openLaunchForm(page, "Tenant move-in");
      });

      await thenStep(
        page,
        {
          clause: "A sees the emails of B, of the administrator and of V, and no names, roles or other profile data.",
          visible: [
            "у списку виконавця кожної задачі є email менеджера B",
            "у списку виконавця є email адміністратора",
            "у списку виконавця є email вендора V",
          ],
          hidden: [
            "кожен пункт списку — або «Me (run manager)», або лише email: без імені, ролі, пробілів чи дужок",
            "імена B, адміністратора й V ніде на сторінці не показано",
            "довідник колег, який отримує A напряму, віддає лише поля id і email",
          ],
        },
        async () => {
          const picker = page.getByRole("combobox", { name: /^Assignee of / }).first();
          await expect(picker).toBeVisible();
          for (const person of [managerB, administrator, vendor]) {
            await expect(picker.getByRole("option", { name: person.email, exact: true })).toHaveCount(1);
          }

          for (const text of await picker.getByRole("option").allTextContents()) {
            expect(text).toMatch(/^(Me \(run manager\)|[^\s@()]+@example\.test)$/);
          }
          for (const person of [managerB, administrator, vendor]) {
            await expect(page.locator("body")).not.toContainText(person.fullName);
          }

          const directory = await (await clientFor(managerA)).rpc("staff_directory");
          expect(directory.error).toBeNull();
          for (const person of directory.data as Record<string, unknown>[]) {
            expect(Object.keys(person).sort()).toEqual(["email", "id"]);
          }
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
