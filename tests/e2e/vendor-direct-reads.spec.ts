// AC-VENDOR-17, AC-VENDOR-18 — прямі читання вендора (уточнення 10.11): в обхід сторінок V отримує лише свої задачі й
// нічого про інших користувачів і про запуск без його задач. «Прямий запит» — справжні виклики Supabase REST/RPC із
// сесією самого вендора (publishable-ключ, з Node, тож токен не потрапляє ні в кадр, ні в трасу), як у
// vendor-forbidden.spec.ts. Відповідь API перевіряють твердження (hidden). На кадрі — те, що V бачить у застосунку з
// тими самими даними: рівно задачі 3 і 4, лише власний email, «Run not found» для «Apartment 14, repair».
// Правило живе в базі (RLS і функції security definer): його доводять тести PGlite tests/db/vendor-work.test.ts і мутанти
// V04, V06, V18, V18P. Пишуть дані: синтетичні uat-<run>-…@example.test і запуски, прибирання — Cast.dispose. Тег @writes.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import {
  APARTMENT_12,
  APARTMENT_14,
  Cast,
  REPAIR_REQUEST,
  clientFor,
  launchApartment12,
  launchAs,
  runTasks,
  signInAs,
  type Actor,
  type RunTask,
} from "./support/vendor";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-VENDOR-17: вендор V прямим запитом, в обхід сторінок, задач «Apartment 12, move-in» (5 задач) отримує лише задачі 3 і 4",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-17" } },
  async ({ page }) => {
    const cast = new Cast("v17");
    try {
      let vendor!: Actor;
      let runId = "";
      let tasks: RunTask[] = [];
      let byRun: string[] = [];
      let byFunction: string[] = [];
      let unfilteredAssignees: string[] = [];

      await given('vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in" (5 tasks)', async () => {
        const manager = await cast.create("mgr-a", "manager");
        vendor = await cast.create("vnd", "vendor");
        ({ runId, tasks } = await launchApartment12(manager, vendor));
        expect(tasks).toHaveLength(5);
        expect(tasks.filter((task) => task.assigneeId === vendor.id).map((task) => task.id)).toEqual([tasks[2].id, tasks[3].id]);
      });

      await when("V requests the tasks of this run directly, bypassing the pages of the application", async () => {
        const client = await clientFor(vendor);
        const direct = await client.from("run_tasks").select("id").eq("run_id", runId);
        expect(direct.error).toBeNull();
        byRun = (direct.data ?? []).map((row) => row.id as string);
        const viaFunction = await client.rpc("vendor_run_tasks", { p_run_id: runId });
        expect(viaFunction.error).toBeNull();
        byFunction = ((viaFunction.data ?? []) as { id: string }[]).map((row) => row.id);
        const unfiltered = await client.from("run_tasks").select("assignee_id");
        expect(unfiltered.error).toBeNull();
        unfilteredAssignees = (unfiltered.data ?? []).map((row) => row.assignee_id as string);
        // Те саме — на сторінці запуску застосунку, з якою звіряємо кадр.
        await signInAs(page, vendor);
        await page.goto(`/runs/${runId}`);
      });

      await thenStep(
        page,
        {
          clause: "V receives only tasks 3 and 4.",
          visible: [`на сторінці запуску V — рівно дві задачі: 3 «${tasks[2]?.name}» і 4 «${tasks[3]?.name}»`],
          hidden: [
            "пряма відповідь REST `run_tasks?run_id=eq.<запуск>` — рівно задачі 3 і 4",
            "пряма відповідь RPC `vendor_run_tasks(<запуск>)` — рівно задачі 3 і 4",
            "`run_tasks` без фільтра — лише задачі, де виконавець V",
            "задач 1, 2 і 5 немає ні у відповідях, ні на сторінці",
          ],
        },
        async () => {
          const own = [tasks[2].id, tasks[3].id].sort();
          expect([...byRun].sort()).toEqual(own);
          expect([...byFunction].sort()).toEqual(own);
          expect(unfilteredAssignees.length).toBeGreaterThan(0);
          expect(unfilteredAssignees.every((id) => id === vendor.id)).toBe(true);
          await expect(page.getByTestId("run-task")).toHaveCount(2);
          await expect(page.getByTestId("run-task").nth(0)).toContainText(tasks[2].name);
          await expect(page.getByTestId("run-task").nth(1)).toContainText(tasks[3].name);
          for (const other of [tasks[0], tasks[1], tasks[4]]) {
            await expect(page.getByRole("main")).not.toContainText(other.name);
          }
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);

test(
  "AC-VENDOR-18: вендор V прямим запитом, в обхід сторінок, email і профілів інших користувачів і задач «Apartment 14, repair» не отримує нічого",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-18" } },
  async ({ page }) => {
    const cast = new Cast("v18");
    try {
      let manager!: Actor;
      let otherManager!: Actor;
      let vendor!: Actor;
      let repairId = "";
      let repairTaskNames: string[] = [];
      const answers: Record<string, unknown[]> = {};
      let vendorRunIds: string[] = [];

      await given(
        'vendor V who is the assignee of tasks 3 and 4 in the run "Apartment 12, move-in" and of no task in the run "Apartment 14, repair"',
        async () => {
          manager = await cast.create("mgr-a", "manager");
          otherManager = await cast.create("mgr-b", "manager");
          vendor = await cast.create("vnd", "vendor");
          await launchApartment12(manager, vendor);
          repairId = await launchAs(manager, REPAIR_REQUEST, APARTMENT_14);
          const repairTasks = await runTasks(repairId);
          expect(repairTasks.length).toBeGreaterThan(0);
          expect(repairTasks.filter((task) => task.assigneeId === vendor.id)).toHaveLength(0);
          repairTaskNames = repairTasks.map((task) => task.name);
        },
      );

      await when(
        'V requests directly, bypassing the pages of the application, the emails and profiles of other users and the tasks of "Apartment 14, repair"',
        async () => {
          const client = await clientFor(vendor);
          const ask = async (name: string, query: PromiseLike<{ data: unknown; error: unknown }>) => {
            const { data, error } = await query;
            expect(error, name).toBeNull();
            answers[name] = (data ?? []) as unknown[];
          };
          await ask("profiles", client.from("profiles").select("id, email, role"));
          await ask("profiles of A and B", client.from("profiles").select("id, email").in("id", [manager.id, otherManager.id]));
          await ask("staff_directory()", client.rpc("staff_directory"));
          await ask("run_tasks of Apartment 14", client.from("run_tasks").select("id, name").eq("run_id", repairId));
          await ask("vendor_run_tasks(Apartment 14)", client.rpc("vendor_run_tasks", { p_run_id: repairId }));
          await ask("run_sections of Apartment 14", client.from("run_sections").select("id").eq("run_id", repairId));
          await ask("runs: Apartment 14", client.from("runs").select("id").eq("id", repairId));
          await ask("run_overview: Apartment 14", client.from("run_overview").select("id").eq("id", repairId));
          const runs = await client.rpc("vendor_runs");
          expect(runs.error).toBeNull();
          vendorRunIds = ((runs.data ?? []) as { id: string }[]).map((run) => run.id);
          // На екрані — профіль V і список його запусків із тими самими даними.
          await signInAs(page, vendor);
        },
      );

      await thenStep(
        page,
        {
          clause: "V receives nothing about other users (the profile page).",
          visible: [`на сторінці профілю — лише власний email V «${vendor?.email ?? "V"}»`],
          hidden: [
            "пряма відповідь `profiles` — лише власний рядок V",
            "профілі менеджерів A і B за їхніми id — порожня відповідь",
            "`staff_directory()` — порожня відповідь (жодного email колег)",
            "email A і B на сторінці немає",
          ],
        },
        async () => {
          expect((answers["profiles"] as { id: string }[]).map((row) => row.id)).toEqual([vendor.id]);
          expect(answers["profiles of A and B"]).toEqual([]);
          expect(answers["staff_directory()"]).toEqual([]);
          await expect(page.getByTestId("user-email")).toHaveText(vendor.email);
          await expect(page.locator("body")).not.toContainText(manager.email);
          await expect(page.locator("body")).not.toContainText(otherManager.email);
        },
      );

      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });

      await thenStep(
        page,
        {
          clause: 'V receives nothing about "Apartment 14, repair" (the list of runs).',
          visible: ["у списку запусків V — лише «Apartment 12, move-in»", "рядка «Apartment 14, repair» немає"],
          hidden: [
            "прямі відповіді для «Apartment 14, repair» порожні: `run_tasks`, `vendor_run_tasks`, `run_sections`, `runs`, `run_overview`",
            "`vendor_runs()` не містить «Apartment 14, repair»",
            "назв задач «Apartment 14, repair» на сторінці немає",
          ],
        },
        async () => {
          for (const name of [
            "run_tasks of Apartment 14",
            "vendor_run_tasks(Apartment 14)",
            "run_sections of Apartment 14",
            "runs: Apartment 14",
            "run_overview: Apartment 14",
          ]) {
            expect(answers[name], name).toEqual([]);
          }
          expect(vendorRunIds).not.toContain(repairId);
          await expect(page.getByTestId("run-row")).toHaveCount(1);
          await expect(page.getByTestId("run-row").first()).toContainText(APARTMENT_12);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);
          for (const name of repairTaskNames) await expect(page.locator("body")).not.toContainText(name);
        },
      );

      await when("V opens the page of \"Apartment 14, repair\" by a direct link", async () => {
        await page.goto(`/runs/${repairId}`);
      });

      await thenStep(
        page,
        {
          clause: "V receives nothing about \"Apartment 14, repair\" (the page of the run by a direct link).",
          visible: ["заголовок-повідомлення «Run not found»"],
          hidden: ["жодної задачі запуску й назви випадку «Apartment 14, repair» на сторінці немає"],
        },
        async () => {
          await expect(page.getByRole("heading", { level: 1, name: "Run not found" })).toBeVisible();
          await expect(page.getByTestId("run-task")).toHaveCount(0);
          await expect(page.locator("body")).not.toContainText(APARTMENT_14);
          for (const name of repairTaskNames) await expect(page.locator("body")).not.toContainText(name);
        },
      );
    } finally {
      await cast.dispose();
    }
  },
);
