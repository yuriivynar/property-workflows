// AC-DOCAI-09, AC-DOCAI-04 (вимога PM solomchaak/property-workflows-spec#59) — AI-розбір документа на сторінці запуску з ЖИВОЮ моделлю (безкоштовна модель OpenRouter
// через ключ проду). Лише UAT на розгорнутому застосунку (`npm run uat -- --url … --grep AC-DOCAI`): у CI й локальній
// збірці ключа немає, і живий виклик моделі в CI заборонено (design.md impl-document-parsing, «AI»): тег @live-ai
// виключає playwright.config.ts, коли UAT_BASE_URL не задано. Кожен тест — один
// запит із денного ліміту. Пишуть дані: синтетичні користувачі uat-<run>-…@example.test і запуск через справжню
// launch_run; прибирання — Cast.dispose (запуск, а з ним і run_document_values). Тег @writes.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { APARTMENT_12, Cast, TENANT_MOVE_IN, clientFor, launchAs, signInAs, type Actor } from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

type GoldenCase = { id: string; input: string };
const golden = JSON.parse(readFileSync("tests/fixtures/golden/cases.json", "utf8")) as GoldenCase[];
const input = (id: string) => golden.find((c) => c.id === id)!.input;

/** Скільки підтверджених значень має запуск — під сесією менеджера (RLS run_document_values). */
async function savedCount(manager: Actor, runId: string): Promise<number> {
  const { count, error } = await (await clientFor(manager))
    .from("run_document_values")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  expect(error).toBeNull();
  return count ?? -1;
}

test(
  "AC-DOCAI-09: менеджер запуску вставляє меню й обирає «Propose values» — «This document is not a maintenance request or an estimate.», жодного значення",
  { tag: ["@uat", "@writes", "@live-ai"], annotation: { type: "ac", description: "AC-DOCAI-09" } },
  async ({ page }) => {
    const cast = new Cast("d07");
    try {
      let runId = "";
      let manager: Actor;

      await given(`run manager A and the pasted text "${input("GC-09")}"`, async () => {
        manager = await cast.create("mgr-a", "manager");
        runId = await launchAs(manager, TENANT_MOVE_IN, APARTMENT_12);
        await signInAs(page, manager);
        await page.goto(`/runs/${runId}`);
        await expect(page.getByTestId("parse-document")).toBeVisible();
      });

      await when('A chooses "Propose values"', async () => {
        await page.getByLabel("Document text").fill(input("GC-09"));
        await page.getByRole("button", { name: "Propose values" }).click();
      });

      await thenStep(
        page,
        {
          clause: 'the block shows "This document is not a maintenance request or an estimate." and no value is proposed.',
          visible: [
            "повідомлення «This document is not a maintenance request or an estimate.»",
            "під повідомленням блок закінчується: немає форми значень і кнопки «Save values»",
            "блок «Parse a document» — останній на сторінці: під карткою лише порожнє тло",
          ],
          hidden: ["у запуску немає збережених значень (run_document_values, 0 рядків)"],
        },
        async () => {
          await expect(page.getByTestId("document-notice")).toHaveText(
            "This document is not a maintenance request or an estimate.",
            { timeout: 120_000 },
          );
          await expect(page.getByTestId("document-values-form")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Save values" })).toHaveCount(0);
          expect(await savedCount(manager, runId)).toBe(0);
          // Кадр «Тоді» знімає лише вікно (1280×800): прокручуємо до самого низу сторінки — видно повідомлення, кінець блоку
          // і порожнє тло під ним (форми значень немає, блок — останній на сторінці).
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-DOCAI-04: менеджер запуску змінює Urgency пропозиції на «urgent» і обирає «Save values» — один запис з «urgent», email і часом",
  { tag: ["@uat", "@writes", "@live-ai"], annotation: { type: "ac", description: "AC-DOCAI-04" } },
  async ({ page }) => {
    const cast = new Cast("d08");
    try {
      let runId = "";
      let manager: Actor;

      await given('run manager A with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "not urgent" proposed in the block', async () => {
        manager = await cast.create("mgr-a", "manager");
        runId = await launchAs(manager, TENANT_MOVE_IN, APARTMENT_12);
        await signInAs(page, manager);
        await page.goto(`/runs/${runId}`);
        await page.getByLabel("Document text").fill(input("GC-01"));
        await page.getByRole("button", { name: "Propose values" }).click();
        const form = page.getByTestId("document-values-form");
        await expect(form).toBeVisible({ timeout: 120_000 });
        await expect(form.getByLabel("Phone")).toHaveValue("555-0101");
        await expect(form.getByLabel("Category")).toHaveValue("plumbing");
        await expect(form.getByLabel("Urgency")).toHaveValue("not urgent");
        await expect(page.getByTestId("document-values")).toHaveCount(0);
        expect(await savedCount(manager, runId)).toBe(0);
      });

      await when('A changes Urgency to "urgent" and chooses "Save values"', async () => {
        const form = page.getByTestId("document-values-form");
        await form.getByLabel("Urgency").selectOption("urgent");
        await form.getByRole("button", { name: "Save values" }).click();
        await expect(form.getByRole("status")).toHaveText("Values saved");
      });

      await thenStep(
        page,
        {
          clause: 'the page of the run shows one saved record with Document type "Maintenance request", Phone "555-0101", Category "plumbing" and Urgency "urgent", the email of A and the date and time of the confirmation.',
          visible: [
            "розділ «Document values» із записом «Maintenance request»",
            "у записі Phone «555-0101», Category «plumbing» і Urgency «urgent»",
            "«Confirmed by» з email менеджера A і часом підтвердження",
          ],
          hidden: [
            "до «Save values» у запуску не було збережених значень (перевірено в «Дано», 0 рядків)",
            "після «Save values» — рівно один рядок run_document_values",
          ],
        },
        async () => {
          const record = page.getByTestId("document-values-record");
          await expect(record).toHaveCount(1);
          await expect(record).toContainText("Maintenance request");
          await expect(record).toContainText("urgent");
          await expect(record).not.toContainText("not urgent");
          await expect(record).toContainText("555-0101");
          await expect(record).toContainText("plumbing");
          await expect(record).toContainText(`Confirmed by ${manager.email}`);
          expect(await savedCount(manager, runId)).toBe(1);
          // Кадр «Тоді» знімає лише вікно: прокручуємо до розділу «Document values» із записом і «Confirmed by».
          await page.getByTestId("document-values").evaluate((el) => el.scrollIntoView({ block: "center" }));
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
