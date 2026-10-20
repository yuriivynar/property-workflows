"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorCodeFrom, isUuid, validateCaseName } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

const ASSIGNEE_FIELD = "assignee:";

// Запуск шаблону для випадку (openspec/specs/run-launch). Перевірка назви тут — щоб показати повідомлення без запиту;
// остаточно правила виконує функція бази launch_run (одна транзакція: запуск, розділи, задачі).
export async function launchRun(formData: FormData) {
  const templateId = String(formData.get("template_id") ?? "");
  const back = (code: string): never =>
    redirect(`/runs/new?template=${encodeURIComponent(templateId)}&error=${encodeURIComponent(code)}`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  if (!isUuid(templateId)) {
    redirect("/runs/new?error=TEMPLATE_NOT_FOUND");
  }

  const check = validateCaseName(String(formData.get("case_name") ?? ""));
  if (!check.ok) {
    return back(check.code);
  }

  // Порожнє значення — «Me (run manager)»: задача без призначення дістається менеджеру запуску (AC-RUN-08, AC-RUN-09).
  const assignments: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(ASSIGNEE_FIELD) && typeof value === "string" && value) {
      assignments[key.slice(ASSIGNEE_FIELD.length)] = value;
    }
  }

  const { data: runId, error } = await supabase.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: check.caseName,
    p_assignments: assignments,
  });
  if (error || !runId) {
    return back(errorCodeFrom(error?.message) ?? "UNEXPECTED");
  }

  revalidatePath("/runs");
  redirect(`/runs/${runId}`);
}
