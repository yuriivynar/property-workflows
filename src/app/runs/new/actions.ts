"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, type RoleCheck } from "@/lib/auth/require-role";
import { errorCodeFrom, isUuid, validateCaseName } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

const ASSIGNEE_FIELD = "assignee:";

// Призначення виконавців із форми: поля «assignee:<id задачі>»; порожнє значення пропускаємо.
function assignmentsFrom(formData: FormData): Record<string, string> {
  const assignments: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(ASSIGNEE_FIELD) && typeof value === "string" && value) {
      assignments[key.slice(ASSIGNEE_FIELD.length)] = value;
    }
  }
  return assignments;
}

const canLaunch = (user: RoleCheck) => user.ok && user.role !== "vendor";

// Запуск шаблону для випадку (openspec/specs/run-launch). Перевірка назви тут — щоб показати повідомлення без запиту;
// остаточно правила виконує функція бази launch_run (одна транзакція: запуск, розділи, задачі).
export async function launchRun(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const back = (code: string): never =>
    redirect(`/runs/new?template=${encodeURIComponent(templateId)}&error=${encodeURIComponent(code)}`);

  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok && user.reason === "NOT_SIGNED_IN") {
    redirect("/login");
  }
  // Запускати шаблон можуть лише менеджер і адміністратор; вендор — відмова до будь-якого запису (AC-VENDOR-09).
  // База (launch_run) перевіряє те саме: вона друга лінія, а не перша.
  if (!canLaunch(user)) {
    return back("LAUNCH_NOT_ALLOWED");
  }

  if (!isUuid(templateId)) {
    redirect("/runs/new?error=TEMPLATE_NOT_FOUND");
  }

  const check = validateCaseName(String(formData.get("case_name") ?? ""));
  if (!check.ok) {
    return back(check.code);
  }

  // Порожнє значення — «Me (run manager)»: задача без призначення дістається менеджеру запуску (AC-RUN-08, AC-RUN-09).
  const assignments = assignmentsFrom(formData);

  // Версія, за якою відкрито форму: якщо її вже замінила нова, база відхилить запуск (TEMPLATE_VERSION_CHANGED).
  // Без коректної версії форми (застаріла чи підроблена форма) — відмова до виклику бази.
  const expected = Number(formData.get("expected_version"));
  if (!Number.isInteger(expected) || expected <= 0) {
    return back("TEMPLATE_VERSION_CHANGED");
  }
  const { data: runId, error } = await supabase.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: check.caseName,
    p_assignments: assignments,
    p_expected_version: expected,
  });
  if (error || !runId) {
    return back(errorCodeFrom(error?.message) ?? "UNEXPECTED");
  }

  revalidatePath("/runs");
  redirect(`/runs/${runId}`);
}
