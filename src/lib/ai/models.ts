// Взято з koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature/src/lib/ai/models.ts (ланцюжок і суддя — без змін).
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Кандидати на 04.11.2026 (OpenRouter GET /api/v1/models). Безкоштовні моделі з'являються й зникають:
// перед роботою запустіть `npm run ai:models` і перевірте ланцюжок живим прогоном `npm run eval`.
// Порядок = пріоритет. Лише ID із `:free`: платна модель у списку fallback оплачується за її ціною.
//   gemma-4-31b / gemma-4-26b — найкраща заявка на багатомовність (українська — ймовірно, у картці не названа);
//     НЕ мають structured_outputs: json_schema може бути проігноровано, тому поля повторено в промпті, а zod — ворота.
//   nemotron-3.5-super-vl     — строга схема (structured_outputs) і зображення; української в її картці немає.
export const PRODUCT_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
] as const;

// Суддя для живого eval — інша родина, ніж модель, що відповіла (не оцінює відповіді своєї родини; ADR 0013).
// Основна відповідь — Gemma, тож типовий суддя — nemotron; якщо відповіла резервна nemotron, суддя — Gemma
// (порада викладача WS10: раніше в такому разі модель оцінювала сама себе).
export const JUDGE_MODEL = "nvidia/nemotron-3.5-super-vl:free";
export const JUDGE_FALLBACK_MODEL = "google/gemma-4-31b-it:free";

/** Родина моделі OpenRouter — частина ID до «/» (google, nvidia…). */
const familyOf = (modelId: string) => modelId.split("/")[0] ?? modelId;

/** Суддя для відповіді цієї моделі: інша родина, ніж у відповіді. Невідома модель — типовий суддя. */
export function judgeModelFor(answerModelId: string): string {
  return familyOf(answerModelId) === familyOf(JUDGE_MODEL) ? JUDGE_FALLBACK_MODEL : JUDGE_MODEL;
}

// Фабрики приймають ключ параметром і НЕ читають process.env: так їх можна імпортувати в eval-скрипті.
// У коді застосунку модель бере лише src/lib/ai/openrouter.ts (server-only).
export function makeProductModel(apiKey: string | undefined) {
  const openrouter = createOpenRouter({ apiKey, appName: "QuitCode slice 4" });
  return openrouter.chat(PRODUCT_MODELS[0], {
    // OpenRouter пробує наступну модель при помилці, ліміті постачальника або простої.
    // Платформний ліміт безкоштовних моделей (20/хв, 50/день на акаунт) ланцюжок НЕ обходить.
    models: [...PRODUCT_MODELS],
    // Без provider.require_parameters: з ним OpenRouter може відкинути Gemma (немає structured_outputs).
    // Файлів (PDF) зріз 4 не надсилає — PDF поза scope, тож плагіна file-parser немає: без нього платний OCR не викликається.
    // Портативний параметр `reasoning` з AI SDK 7 цей провайдер не передає — лише його власний.
    reasoning: { effort: "low", exclude: true },
  });
}

export function makeJudgeModel(apiKey: string | undefined, modelId: string = JUDGE_MODEL) {
  const openrouter = createOpenRouter({ apiKey, appName: "QuitCode slice 4 eval" });
  return openrouter.chat(modelId);
}
