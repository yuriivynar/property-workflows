// AC-EDITOR-09 — відмова, яку видно в браузері (не увійшов). Лише читання: безпечно на спільному проді.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

// Явно без сесії: відвідувач не увійшов.
test.use({ storageState: { cookies: [], origins: [] } });

// «Tenant move-in» — довідковий шаблон зі стабільним id (supabase/migrations/20261020115709_workflow_templates_reference_data.sql).
const EDITOR = "/templates/10000000-0000-4000-8000-000000000001/edit";
// Вміст шаблону з тієї самої міграції: назва, розділи й задачі.
const TEMPLATE_CONTENT = [
  "Tenant move-in",
  "Before move-in",
  "Move-in day",
  "Sign the lease",
  "Collect the deposit",
  "Order cleaning",
  "Hand over the keys",
  "Record meter readings",
];

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-EDITOR-09: відвідувач без входу за прямим посиланням на редактор бачить сторінку входу й жодного вмісту шаблону",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-09" } },
  async ({ page }) => {
    await given("a visitor who is not signed in", async () => {
      expect(await page.context().cookies()).toEqual([]);
    });

    await when("the visitor opens the editor of the template \"Tenant move-in\" by a direct link", async () => {
      await page.goto(EDITOR);
    });

    await thenStep(
      page,
      {
        clause: "the visitor sees the sign-in page and no content of the template.",
        visible: ["сторінка входу (заголовок «Sign in»)", "поля «Email» і «Password»"],
        hidden: [
          "жодного вмісту шаблону: немає назви «Tenant move-in», розділів «Before move-in», «Move-in day» і жодної з 5 задач",
          "адреса — /login (з поверненням на редактор після входу)",
        ],
      },
      async () => {
        await expect(page).toHaveURL((url) => url.pathname === "/login");
        await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();
        const text = await page.locator("body").innerText();
        for (const item of TEMPLATE_CONTENT) expect(text, item).not.toContain(item);
      },
    );
  },
);
