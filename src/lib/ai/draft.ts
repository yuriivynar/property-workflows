import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { DRAFT_INSTRUCTIONS, wrapDocument } from "./prompts/draft";
import { ProposalSchema, type Proposal } from "./schema";

// Чиста функція: модель передають параметром. Застосунок передає модель OpenRouter (src/lib/ai/openrouter.ts),
// тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і немає process.env,
// тому Vitest може імпортувати цей файл.
// Взято з koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature/src/lib/ai/draft.ts; файлів (PDF, фото) немає —
// PDF поза scope (requirements/product.md), вхід — лише вставлений текст.

export type FailureReason = "invalid_output" | "rate_limited" | "timeout" | "provider_error";

export type ProposalResult =
  | { ok: true; proposal: Proposal; modelId: string }
  | { ok: false; reason: FailureReason; message: string };

export type ProposalOptions = {
  maxRetries?: number;
  timeoutMs?: number;
};

export async function proposeDocumentValues(
  text: string,
  model: LanguageModel,
  opts: ProposalOptions = {},
): Promise<ProposalResult> {
  try {
    const result = await generateText({
      model,
      instructions: DRAFT_INSTRUCTIONS, // `system` в AI SDK 7 застаріле
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(text) }] }],
      output: Output.object({ name: "document_values", schema: ProposalSchema }),
      temperature: 0,
      // На безкоштовному тарифі повтор витрачає той самий денний ліміт: 0–1, не типові 2.
      maxRetries: opts.maxRetries ?? 1,
      timeout: opts.timeoutMs ?? 45_000,
    });
    // result.output уже перевірено за ProposalSchema (інакше — виняток NoObjectGeneratedError).
    return { ok: true, proposal: result.output, modelId: result.response.modelId };
  } catch (error) {
    return classifyError(error);
  }
}

export function classifyError(error: unknown): Extract<ProposalResult, { ok: false }> {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { ok: false, reason: "invalid_output", message: `model output did not match the schema${schemaDetails(cause)}` };
  }
  if (APICallError.isInstance(cause)) {
    // OpenRouter може відповісти HTTP 200 з тілом `error`; провайдер тоді кидає statusCode 200 + data.
    const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
    if (code === 429 || code === "429") {
      return { ok: false, reason: "rate_limited", message: "free-model limit reached, try later" };
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { ok: false, reason: "timeout", message: "model did not answer in time" };
  }
  return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}

/**
 * Чому відповідь не за схемою — для звіту eval і логу: finishReason (length = відповідь обрізано), назва помилки
 * розбору й шляхи полів zod з кодом. Без тексту документа й відповіді моделі (у них можуть бути телефони й імена).
 */
function schemaDetails(error: NoObjectGeneratedError): string {
  const parts: string[] = [];
  if (error.finishReason && error.finishReason !== "stop") parts.push(`finishReason=${error.finishReason}`);
  const fields = new Set<string>();
  let current: unknown = error.cause;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    if (depth === 0) parts.push(current.name);
    const issues = (current as { issues?: unknown }).issues;
    if (Array.isArray(issues)) {
      for (const issue of issues as { path?: PropertyKey[]; code?: string }[]) {
        fields.add(`${(issue.path ?? []).map(String).join(".") || "(root)"}: ${issue.code ?? "invalid"}`);
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  parts.push(...[...fields].slice(0, 5));
  return parts.length ? ` (${parts.join("; ")})` : "";
}
