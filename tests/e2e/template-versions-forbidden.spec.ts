// AC-EDITOR-07 — відмова, яку видно в браузері (заборонена роль). Лише читання: безпечно на спільному проді.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/manager.json" });

const MANAGER_B = "manager.b@example.test";
// «Tenant move-in» — довідковий шаблон зі стабільним id (supabase/migrations/20261020115709_workflow_templates_reference_data.sql).
const VERSIONS = "/templates/10000000-0000-4000-8000-000000000001/versions";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-EDITOR-07: менеджер B за прямим посиланням на список версій бачить «Not enough rights» і жодної версії",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-07" } },
  async ({ page, browser }) => {
    await given("manager B signed in and the template \"Tenant move-in\" with versions 1 and 2", async () => {
      await page.goto("/");
      await expect(page.getByTestId("user-email")).toHaveText(MANAGER_B);
      // Версії бачить лише адміністратор — перевіряємо «Дано» окремим контекстом під ним (лише читання).
      const admin = await browser.newContext({ storageState: "playwright/.auth/admin.json" });
      try {
        const adminPage = await admin.newPage();
        await adminPage.goto(VERSIONS);
        // Комірка, а не hasText рядка: текст рядка склеєно без пробілів («Version 127.10.2026…»), і /^Version 1\b/ не збігається.
        const versionCell = (n: number) =>
          adminPage.getByTestId("version-row").getByRole("cell", { name: `Version ${n}`, exact: true });
        await expect(versionCell(1)).toHaveCount(1);
        await expect(versionCell(2)).toHaveCount(1);
      } finally {
        await admin.close();
      }
    });

    await when("B opens the list of versions of this template by a direct link", async () => {
      await page.goto(VERSIONS);
    });

    await thenStep(
      page,
      {
        clause: "B sees the message \"Not enough rights\" and no versions.",
        visible: ["повідомлення «Not enough rights»", "посилання «Back to templates»"],
        hidden: [
          "жодної версії: на сторінці немає таблиці версій і рядків «Version N»",
          "адреса лишилась сторінкою списку версій (відмова на тому самому місці, а не перехід)",
        ],
      },
      async () => {
        await expect(page).toHaveURL((url) => url.pathname === VERSIONS);
        const notice = page.getByRole("main").getByRole("status");
        await expect(notice.getByRole("heading", { level: 1 })).toHaveText("Not enough rights");
        await expect(notice.getByRole("link", { name: "Back to templates" })).toBeVisible();
        await expect(page.getByRole("table")).toHaveCount(0);
        await expect(page.getByTestId("version-row")).toHaveCount(0);
        await expect(page.getByText(/\bVersion \d+\b/)).toHaveCount(0);
      },
    );
  },
);
