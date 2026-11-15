import { Output, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { ProposalView } from "@/lib/documents/values";
import { JUDGE_INSTRUCTIONS, judgePrompt } from "./prompts/judge";
import type { Item } from "./schema";

// Взято з koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature/src/lib/ai/scorer.ts, поля — під зріз 4.
// Оцінюємо те, що бачить людина (ProposalView: відповідь моделі + правила коду), а не сирий JSON моделі.

/** Один golden case PM (solomchaak/property-workflows-spec#40). Формат файлу — tests/fixtures/golden/cases.json. */
export type GoldenCase = {
  id: string; // "GC-01" — кейс 1 з #40
  ac: string; // тимчасовий AC зрізу 4, який доводить кейс
  input: string;
  // Лише поля, які PM фіксує однозначно. Порівнюються точно; notes — «має містити» (лише тексти, які формує код).
  expected: {
    state: ProposalView["state"];
    kind?: "request" | "estimate";
    phone?: string | null;
    category?: string | null;
    urgency?: string | null;
    items?: Item[];
    total?: number | null;
    warning?: string | null;
    message?: string;
    notes?: string[];
  };
  // Слова PM: що опис і примітки мають містити / чого не мають. Оцінює LLM-суддя лише в живому eval (Q17 — за змістом).
  rubric?: string;
};

type Mismatch = { field: string; expected: unknown; actual: unknown };

/** (1) Детермінована частина: точний збіг полів, зафіксованих PM у golden case. */
export function scoreFields(expected: GoldenCase["expected"], view: ProposalView) {
  const mismatches: Mismatch[] = [];
  const actual = view as Record<string, unknown>;
  for (const [field, want] of Object.entries(expected)) {
    if (field === "notes") {
      const have = view.state === "proposed" ? view.notes : [];
      const missing = (want as string[]).filter((note) => !have.includes(note));
      if (missing.length > 0) mismatches.push({ field, expected: want, actual: have });
      continue;
    }
    if (JSON.stringify(actual[field] ?? null) !== JSON.stringify(want ?? null)) {
      mismatches.push({ field, expected: want, actual: actual[field] ?? null });
    }
  }
  return { pass: mismatches.length === 0, mismatches };
}

/** Вільний текст для судді: опис і примітки, як їх бачить людина. */
export function freeText(view: ProposalView): string {
  if (view.state === "refused") return view.message;
  return [`description: ${view.description ?? "(empty)"}`, `notes: ${view.notes.join("; ") || "(none)"}`].join("\n");
}

// (2) Нечітка частина: LLM-суддя лише для вільного тексту, двійковий вердикт із причиною.
const Verdict = z.object({ pass: z.boolean(), reason: z.string().max(300) });
export type JudgeVerdict = z.infer<typeof Verdict>;

export async function judgeFreeText(judge: LanguageModel, rubric: string, text: string): Promise<JudgeVerdict> {
  const { output } = await generateText({
    model: judge,
    instructions: JUDGE_INSTRUCTIONS,
    prompt: judgePrompt(rubric, text),
    output: Output.object({ name: "verdict", schema: Verdict }),
    temperature: 0,
    maxRetries: 0, // повтор на безкоштовному тарифі витрачає той самий денний ліміт
  });
  return output;
}

/** Частка успіху (pass rate) — визначення з WS8: прогін на задачах із відомими відповідями (ключ) → бал. */
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}
