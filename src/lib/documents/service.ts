import type { SupabaseClient } from "@supabase/supabase-js";
import type { LanguageModel } from "ai";
import { proposeDocumentValues } from "@/lib/ai/draft";
import type { RoleCheck } from "@/lib/auth/require-role";
import { isUuid } from "@/lib/runs/domain";
import type { Database } from "@/lib/supabase/database.types";
import { DOCUMENT_ERRORS, DOCUMENT_LABELS, canUseDocumentBlock, confirmedValuesFrom, documentTextFrom, type ParseState, type SaveState } from "./form";
import { DOCUMENT_MESSAGES, toProposalView, toStoredValues } from "./values";

// Розбір документа в запуску: що роблять дії «Propose values» і «Save values» після перевірки входу
// (src/app/runs/[id]/_document/actions.ts; openspec/changes/impl-document-parsing/design.md, «Auth»). Залежності —
// параметрами: клієнт Supabase під сесією користувача, роль з currentUser() і модель (null — ключа немає). Так тести
// передають справжній MockLanguageModelV4 і мок клієнта, а не мокають власні модулі.
// Роль перевіряємо ДО виклику моделі чи запису: інакше будь-хто витратив би денний ліміт безкоштовних запитів (50 на
// акаунт) або записав значення в чужий запуск. RLS run_document_values — друга лінія.

type Client = SupabaseClient<Database>;

export type DocumentDeps = {
  supabase: Client;
  user: RoleCheck;
};

/**
 * Хто розбирає документ і зберігає значення: адміністратор або менеджер цього запуску (варіант A
 * solomchaak/property-workflows-spec#53). Запуск читаємо під RLS: чужого запуску менеджер не побачить.
 */
async function mayWorkWithDocuments({ supabase, user }: DocumentDeps, runId: string): Promise<boolean> {
  if (!user.ok || user.role === "vendor" || !isUuid(runId)) return false;
  const { data: run, error } = await supabase.from("runs").select("run_manager_id").eq("id", runId).maybeSingle();
  if (error || !run) return false;
  return canUseDocumentBlock(user, run.run_manager_id);
}

/** «Propose values»: пропозиція моделі для людини. Нічого не пише в базу (AC-DOCAI-08). */
export async function requestValues(
  deps: DocumentDeps & { model: LanguageModel | null },
  formData: FormData,
): Promise<ParseState> {
  const input = documentTextFrom(formData);
  if (!(await mayWorkWithDocuments(deps, String(formData.get("run_id") ?? "")))) {
    return { status: "error", text: input.text, message: DOCUMENT_ERRORS.notAllowed };
  }
  if (!input.ok) return { status: "error", text: input.text, message: input.message };

  // Немає ключа, 429, таймаут, відповідь не за схемою, помилка постачальника — той самий стан «недоступний» і ручний
  // ввід, без повторів у циклі (AC-DOCAI-09; варіант A #52).
  if (!deps.model) return { status: "unavailable", text: input.text, message: DOCUMENT_MESSAGES.unavailable };
  const result = await proposeDocumentValues(input.text, deps.model);
  if (!result.ok) {
    // У лог — лише причина, без тексту документа (у ньому можуть бути телефони й імена).
    console.warn(`document parsing unavailable: ${result.reason}`);
    return { status: "unavailable", text: input.text, message: DOCUMENT_MESSAGES.unavailable };
  }

  const view = toProposalView(result.proposal, input.text);
  if (view.state === "refused") return { status: "refused", text: input.text, message: view.message };
  return { status: "proposed", text: input.text, view };
}

/**
 * «Save values»: значення, які людина бачила й, можливо, виправила або ввела вручну (AC-DOCAI-08, AC-DOCAI-09). Сервер
 * перевіряє їх ще раз (zod) і сам рахує телефон у формі та попередження про суму (AC-DOCAI-01, AC-DOCAI-06).
 */
export async function confirmValues(deps: DocumentDeps, formData: FormData): Promise<SaveState> {
  const runId = String(formData.get("run_id") ?? "");
  if (!(await mayWorkWithDocuments(deps, runId))) return { status: "error", message: DOCUMENT_ERRORS.notAllowed };

  const confirmed = confirmedValuesFrom(formData);
  if (!confirmed.ok) return { status: "error", message: DOCUMENT_ERRORS.invalidValues };

  const { kind, ...fields } = toStoredValues(confirmed.values);
  const { error } = await deps.supabase.from("run_document_values").insert({ run_id: runId, kind, fields });
  if (error) return { status: "error", message: DOCUMENT_ERRORS.unexpected };
  return { status: "saved", message: DOCUMENT_LABELS.saved };
}
