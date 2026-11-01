// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування на AC-EDITOR-07 (формат — materials/uat/examples курсу WS8).
// Не AC-тести: назви починаються з NC-, тож ac:coverage їх не рахує. У звичайному прогоні їх немає (проєкт chromium
// має grepInvert @negative-control); запуск: npm run uat:nc. Лише читання: безпечно на проді.
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент (R1);
//   NC-2 — текст «Тоді» у вимозі «уточнено», а тест і застосунок ні → перевірки зелені, агент звіряє кадр із новим
//          текстом і не погоджується → NEEDS-HUMAN (R3).
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: "playwright/.auth/manager.json" });

const VERSIONS = "/templates/10000000-0000-4000-8000-000000000001/versions";
const CLAUSE = "B sees the message \"Not enough rights\" and no versions.";
const WRONG_MESSAGE = "You do not have access to versions";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "NC-1 (AC-EDITOR-07, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-EDITOR-07" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    await given("manager B signed in and the template \"Tenant move-in\" with versions 1 and 2", async () => {
      await page.goto("/");
    });
    await when("B opens the list of versions of this template by a direct link", async () => {
      await page.goto(VERSIONS);
    });
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «Not enough rights»"] }, async () => {
      await expect(page.getByRole("main").getByRole("status").getByRole("heading")).toHaveText(WRONG_MESSAGE, {
        timeout: 5_000,
      });
    });
  },
);

test(
  "NC-2 (AC-EDITOR-07, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-EDITOR-07" },
      { type: "case", description: "NC-2" },
      {
        type: "ac-text",
        description:
          "AC-EDITOR-07: Given manager B signed in and the template \"Tenant move-in\" with versions 1 and 2. When B opens the list of versions of this template by a direct link. Then B sees the message \"Only administrators can see versions\" and no versions.",
      },
    ],
  },
  async ({ page }) => {
    await given("manager B signed in and the template \"Tenant move-in\" with versions 1 and 2", async () => {
      await page.goto("/");
    });
    await when("B opens the list of versions of this template by a direct link", async () => {
      await page.goto(VERSIONS);
    });
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «Not enough rights»"] }, async () => {
      await expect(page).toHaveURL((url) => url.pathname === VERSIONS);
      await expect(page.getByRole("main").getByRole("status").getByRole("heading")).toHaveText("Not enough rights");
    });
  },
);
