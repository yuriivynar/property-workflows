// AC-EDITOR-19 — стан інтерфейсу: помилка з дослівним текстом. Нічого не пише: за «Тоді» шаблон не створюється
// (якби продукт таки створив — тест упав би на кількості рядків, і це вада продукту, яку видно в звіті).
import { expect, test, type Page } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/admin.json" });

const ADMIN_A = "admin@example.test";
const MESSAGE = "Enter a template name";

// Шаблони — картки (UI v3), не рядки таблиці.
const templateRows = (page: Page) => page.getByTestId("template-row");

// Створення — у вікні за кнопкою «New template» (рішення власника 2026-11-26, ADR 0012).
async function createWithName(page: Page, name: string) {
  if (!(await page.getByRole("dialog").isVisible())) await page.getByRole("button", { name: "New template" }).click();
  await page.getByRole("dialog").getByLabel("Template name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Create a template" }).click();
  await page.waitForURL((url) => url.searchParams.has("error"));
}

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-EDITOR-19: адміністратор створює шаблон з порожньою назвою чи лише з пробілів — шаблон не створено, «Enter a template name»",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-19" } },
  async ({ page }) => {
    let rowsBefore = 0;

    await given("administrator A", async () => {
      await page.goto("/");
      await expect(page.getByTestId("user-email")).toHaveText(ADMIN_A);
      await page.goto("/templates");
      await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
      rowsBefore = await templateRows(page).count();
    });

    await when("A creates a new template with the name empty", async () => {
      await createWithName(page, "");
    });

    await thenStep(
      page,
      {
        clause: "no template is created, and A sees the message \"Enter a template name\".",
        visible: ["повідомлення про помилку «Enter a template name» під полем «Template name» у вікні «New template»"],
        hidden: ["шаблон не створено: у списку шаблонів стільки ж карток, скільки до спроби"],
      },
      async () => {
        await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(MESSAGE);
        await expect(templateRows(page)).toHaveCount(rowsBefore);
      },
    );

    await when("A creates a new template with the name consisting only of spaces", async () => {
      await page.goto("/templates");
      await createWithName(page, "   ");
    });

    await thenStep(
      page,
      {
        clause: "no template is created, and A sees the message \"Enter a template name\".",
        visible: ["повідомлення про помилку «Enter a template name» під полем «Template name» у вікні «New template»"],
        hidden: [
          "назва з самих пробілів рахується порожньою",
          "шаблон не створено: у списку шаблонів стільки ж карток, скільки до спроби",
        ],
      },
      async () => {
        await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(MESSAGE);
        await expect(templateRows(page)).toHaveCount(rowsBefore);
      },
    );
  },
);
