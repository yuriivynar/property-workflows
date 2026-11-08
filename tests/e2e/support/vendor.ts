// Спільні помічники UAT зрізу 3 (вендор — виконавець задач, AC-VENDOR-01…10): синтетичні користувачі з потрібною
// роллю, запуски через справжню функцію бази launch_run від імені синтетичного менеджера, окремий браузерний
// контекст на кожну роль і прибирання. Дані — лише uat-<run>-<суфікс>@example.test (див. support/admin.ts).
// Ніколи не друкуємо паролі й токени: вони живуть лише в пам'яті тесту.
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, deleteUatUsers, randomPassword, uatEmail } from "./admin";

// Довідкові шаблони зі стабільними id (supabase/migrations/20261020115709_workflow_templates_reference_data.sql).
export const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
export const REPAIR_REQUEST = "10000000-0000-4000-8000-000000000002";

// Назви випадків — дослівно з AC PM: RLS ізолює синтетичних користувачів, тож збігу з чужими запусками немає.
export const APARTMENT_12 = "Apartment 12, move-in";
export const APARTMENT_14 = "Apartment 14, repair";

export type Role = "manager" | "admin" | "vendor";

export type Actor = { id: string; email: string; fullName: string; role: Role; password: string };

export type TemplateTask = {
  id: string;
  name: string;
  isRequired: boolean;
  sectionName: string;
};

export type RunTask = {
  id: string;
  name: string;
  status: string;
  assigneeId: string;
  isRequired: boolean;
  sectionName: string;
};

/**
 * Склад одного тесту: користувачі, їхні браузерні контексти й прибирання. Суфікс адреси — `<слаг тесту>-<ключ>`,
 * тож адреси різних тестів одного прогону не збігаються.
 */
export class Cast {
  private readonly actors: Actor[] = [];
  private readonly contexts: BrowserContext[] = [];

  constructor(private readonly slug: string) {}

  /** Синтетичний користувач: роль — у public.profiles.role (ніколи з user_metadata), ім'я — впізнаване, щоб помітити витік. */
  async create(key: string, role: Role): Promise<Actor> {
    const admin = adminClient();
    const email = uatEmail(`${this.slug}-${key}`);
    const password = randomPassword();
    const fullName = `Uat Person ${this.slug} ${key}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`Не вдалося створити ${email}: ${error?.message ?? "без відповіді"}`);
    const actor: Actor = { id: data.user.id, email, fullName, role, password };
    this.actors.push(actor);
    const { error: profileError } = await admin
      .from("profiles")
      .update({ role, full_name: fullName })
      .eq("id", actor.id);
    if (profileError) throw new Error(`Не вдалося призначити роль ${role} для ${email}: ${profileError.message}`);
    return actor;
  }

  /** Окремий браузерний контекст, у якому актор увійшов через форму входу (а не через спільні storageState). */
  async page(browser: Browser, actor: Actor): Promise<Page> {
    const context = await browser.newContext();
    this.contexts.push(context);
    const page = await context.newPage();
    await signInAs(page, actor);
    return page;
  }

  /** Прибирання: спершу контексти, потім користувачі — менеджери й адміністратори (власники запусків) раніше за вендорів. */
  async dispose() {
    await Promise.all(this.contexts.map((context) => context.close().catch(() => undefined)));
    const ordered = [...this.actors.filter((a) => a.role !== "vendor"), ...this.actors.filter((a) => a.role === "vendor")];
    for (const actor of ordered) await deleteUatUsers(actor.email);
  }
}

/** Клієнт Supabase із сесією цього актора (publishable-ключ, як у браузера) — для «прямих» запитів у обхід сторінок. */
export async function clientFor(actor: Actor): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Потрібні NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: actor.email, password: actor.password });
  if (error) throw new Error(`Не вдалося увійти як ${actor.email}: ${error.message}`);
  return client;
}

/** Поточна версія шаблону: номер і задачі в порядку розділів і позицій (1 … 5 для «Tenant move-in»). */
export async function currentTemplate(templateId: string): Promise<{ version: number; tasks: TemplateTask[] }> {
  const admin = adminClient();
  const { data: template, error } = await admin.from("templates").select("current_version").eq("id", templateId).single();
  if (error || !template?.current_version) throw new Error(`Шаблон ${templateId} без збереженої версії`);
  const { data: version, error: versionError } = await admin
    .from("template_versions")
    .select("content")
    .eq("template_id", templateId)
    .eq("number", template.current_version)
    .single();
  if (versionError || !version) throw new Error(`Не прочитано версію ${template.current_version} шаблону ${templateId}`);
  type Snapshot = {
    sections: {
      name: string;
      position: number;
      tasks: { id: string; name: string; is_required: boolean; position: number }[];
    }[];
  };
  const sections = [...(version.content as Snapshot).sections].sort((a, b) => a.position - b.position);
  const tasks = sections.flatMap((section) =>
    [...section.tasks]
      .sort((a, b) => a.position - b.position)
      .map((task) => ({ id: task.id, name: task.name, isRequired: task.is_required, sectionName: section.name })),
  );
  return { version: template.current_version, tasks };
}

/** Запуск через справжню функцію бази launch_run від імені менеджера: призначення — {id задачі шаблону: id виконавця}. */
export async function launchAs(
  manager: Actor,
  templateId: string,
  caseName: string,
  assignments: Record<string, string> = {},
): Promise<string> {
  const client = await clientFor(manager);
  const { data, error } = await client.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: caseName,
    p_assignments: assignments,
  });
  if (error || !data) throw new Error(`launch_run не створив запуск «${caseName}»: ${error?.message ?? "без id"}`);
  return data as string;
}

/** Задачі запуску з бази (в обхід RLS, лише для підготовки «Дано» і прихованих перевірок): 1 … N у порядку шаблону. */
export async function runTasks(runId: string): Promise<RunTask[]> {
  const admin = adminClient();
  const [sections, tasks] = await Promise.all([
    admin.from("run_sections").select("id, name, position").eq("run_id", runId),
    admin.from("run_tasks").select("id, name, status, assignee_id, is_required, position, section_id").eq("run_id", runId),
  ]);
  if (sections.error || tasks.error) throw new Error(`Не прочитано задачі запуску: ${(sections.error ?? tasks.error)?.message}`);
  const sectionById = new Map((sections.data ?? []).map((section) => [section.id as string, section]));
  return (tasks.data ?? [])
    .sort(
      (a, b) =>
        sectionById.get(a.section_id)?.position - sectionById.get(b.section_id)?.position || a.position - b.position,
    )
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      status: row.status as string,
      assigneeId: row.assignee_id as string,
      isRequired: row.is_required as boolean,
      sectionName: sectionById.get(row.section_id)?.name as string,
    }));
}

/** Скільки запусків у базі за умовою — для прихованих перевірок «запуск не створено» (в обхід RLS). */
export async function countRuns(filter: { runManagerId?: string; caseName?: string }): Promise<number> {
  let query = adminClient().from("runs").select("*", { count: "exact", head: true });
  if (filter.runManagerId) query = query.eq("run_manager_id", filter.runManagerId);
  if (filter.caseName) query = query.eq("case_name", filter.caseName);
  const { count, error } = await query;
  if (error) throw new Error(`Не пораховано запуски: ${error.message}`);
  return count ?? 0;
}

/** «Apartment 12, move-in»: A запускає «Tenant move-in», задачі 3 і 4 — вендору V (спільне «Дано» AC-VENDOR-03…07). */
export async function launchApartment12(manager: Actor, vendor: Actor): Promise<{ runId: string; tasks: RunTask[] }> {
  const { tasks: templateTasks } = await currentTemplate(TENANT_MOVE_IN);
  const runId = await launchAs(manager, TENANT_MOVE_IN, APARTMENT_12, {
    [templateTasks[2].id]: vendor.id,
    [templateTasks[3].id]: vendor.id,
  });
  return { runId, tasks: await runTasks(runId) };
}

/**
 * Вхід у контексті тесту (фікстура page) через форму входу. Свій, а не signIn з uat.ts: вендор після входу потрапляє
 * на /runs (src/app/login/actions.ts), а не на «/». Пароль вводимо через evaluate — він не потрапляє в назви кроків.
 * Особу перевіряємо за email на сторінці профілю.
 */
export async function signInAs(page: Page, actor: Actor) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(actor.email);
  await page.getByLabel("Password").evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
  }, actor.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/runs");
  await page.goto("/");
  await expect(page.getByTestId("user-email")).toHaveText(actor.email);
}
