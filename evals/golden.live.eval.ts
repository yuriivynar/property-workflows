import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classifyError, proposeDocumentValues } from "@/lib/ai/draft";
import { JUDGE_MODEL, PRODUCT_MODELS, judgeModelsFor, makeJudgeModel, makeProductModel } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { JUDGE_PROMPT_VERSION } from "@/lib/ai/prompts/judge";
import { ProposalSchema } from "@/lib/ai/schema";
import { freeText, judgeFreeText, passRate, scoreFields, type GoldenCase } from "@/lib/ai/scorer";
import { toProposalView } from "@/lib/documents/values";
import casesJson from "../tests/fixtures/golden/cases.json";

// Взято з koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature/evals/golden.live.eval.ts; оцінюємо ProposalView
// (відповідь моделі + правила коду src/lib/documents/values.ts), суддя — опис і примітки (Q17 solomchaak/property-workflows-spec#56: за змістом).
// `npm run eval` — ЖИВИЙ прогін golden cases на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в CI.
// Потрібен ваш ключ у .env.local (OPENROUTER_API_KEY). Без ключа всі кейси пропускаються — це не помилка.
// Перший 429 (моделі чи судді) зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою — FAIL з причиною (входять у частку успіху).
//   RUNS=2    — кілька прогонів поспіль для частки успіху (pass rate); бюджет див. нижче.
//   RECORD=1  — УСІ відповіді: успішні — у tests/fixtures/golden/recorded.json (офлайн-реплей в CI), неуспішні —
//               у tests/fixtures/golden/recorded-failures.json з розбіжностями (офлайн-тест перевіряє, що код їх відхиляє).
//   CASES=GC-03,GC-10 — лише ці кейси (дорозбір, коли денного ліміту бракує на всі 10); поріг такий звіт не рахує.
// PowerShell: $env:RECORD="1"; npm run eval   (а потім Remove-Item Env:RECORD)

const allCases = casesJson as GoldenCase[];
const only = (process.env.CASES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const unknown = only.filter((id) => !allCases.some((c) => c.id === id));
if (unknown.length > 0) throw new Error(`CASES: немає таких кейсів: ${unknown.join(", ")}`);
const cases = only.length > 0 ? allCases.filter((c) => only.includes(c.id)) : allCases;
const PARTIAL = cases.length < allCases.length;
const key = process.env.OPENROUTER_API_KEY;
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const FAILURES_PATH = "tests/fixtures/golden/recorded-failures.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — 10 викликів моделі + до 10 викликів судді, з одного денного лічильника акаунта
// (50/день без покупки ≥10 кредитів). Ланцюжок `models` цей ліміт не обходить, спроби fallback теж можуть рахуватися.
const NEEDED = RUNS * (cases.length + cases.filter((c) => c.rubric).length);
const GAP_MS = 3_000; // ≤ 20 запитів/хв навіть коли модель і суддя відповідають швидко

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
// notRun — кейс не запускали через ліміт (429): у частку успіху не входить, у звіті — окремим рядком з причиною.
type Row = { run: number; id: string; modelId: string; fields: boolean; judge?: boolean; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
// Відповіді, що не пройшли точні поля PM (порада викладача WS10: записувати всі відповіді, а не лише ✅).
const freshFailures: Record<string, Recording & { mismatches: unknown[] }> = {};
// Перший 429 зупиняє прогін (і наступні RUNS): денний ліміт повтором не виправити, решта кейсів — NOT RUN.
let stoppedAt: string | undefined;

describe.skipIf(!key)("golden cases, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id}`, async (ctx) => {
        if (stoppedAt) {
          rows.push({ run, id: c.id, modelId: "—", fields: false, pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        // maxRetries 0: денний 429 повтором не виправити, повтор лише з'їдає ліміт.
        const result = await proposeDocumentValues(c.input, makeProductModel(key), { maxRetries: 0, timeoutMs: 90_000 });
        if (!result.ok) {
          // Рядок у звіт — ДО перевірки: інакше кейс зникає зі звіту, і частку успіху рахують з меншого знаменника.
          if (reportModelFailure(run, c, result)) return ctx.skip();
        }
        expect(result.ok, result.ok ? "" : `${result.reason}: ${result.message}`).toBe(true);
        if (!result.ok) return;
        const view = toProposalView(result.proposal, c.input);
        const fields = scoreFields(c.expected, view);
        const judged = await judgeCase(c, view, result.modelId);
        if (judged === "rate_limited") {
          stoppedAt = `${c.id}, прогін ${run}, суддя`;
          rows.push({ run, id: c.id, modelId: result.modelId, fields: fields.pass, pass: false, notRun: true, why: `NOT RUN: суддя — 429` });
          return ctx.skip();
        }
        const pass = fields.pass && (judged?.pass ?? true);
        rows.push({ run, id: c.id, modelId: result.modelId, fields: fields.pass, judge: judged?.pass, pass, why: [fieldsWhy(fields.mismatches), judged?.reason].filter(Boolean).join("; ") });
        // Записуємо всі відповіді: ✅ — для офлайн-реплею, ❌ за точними полями — окремо, з розбіжностями.
        if (RECORD && pass) fresh[c.id] = recording(result);
        if (RECORD && !fields.pass) freshFailures[c.id] = { ...recording(result), mismatches: fields.mismatches };
        expect(fields.mismatches).toEqual([]);
        if (judged) expect(judged.pass, judged.reason).toBe(true);
      });
    }
  }

  afterAll(() => {
    console.table(rows); // яка модель з ланцюжка відповіла на кожен кейс: бал — за модель, а не «за AI»
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
      const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
    if (RECORD) {
      // Неуспішні відповіді цього прогону замінюють попередні; кейс, що тепер пройшов, з файла зникає.
      const old = JSON.parse(readFileSync(FAILURES_PATH, "utf8")) as Record<string, unknown>;
      for (const id of Object.keys(fresh)) delete old[id];
      writeFileSync(FAILURES_PATH, JSON.stringify({ ...old, ...freshFailures }, null, 2) + "\n");
    }
  });
});

type Failure = Extract<Awaited<ReturnType<typeof proposeDocumentValues>>, { ok: false }>;
type Success = Extract<Awaited<ReturnType<typeof proposeDocumentValues>>, { ok: true }>;

/** Рядок звіту для збою моделі; true — це 429: прогін зупиняється, кейс — NOT RUN, а не FAIL. */
function reportModelFailure(run: number, c: GoldenCase, result: Failure): boolean {
  if (result.reason === "rate_limited") {
    stoppedAt = `${c.id}, прогін ${run}`;
    rows.push({ run, id: c.id, modelId: "—", fields: false, pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
    return true;
  }
  // Таймаут, помилка постачальника, відповідь не за схемою — це FAIL з причиною, він входить у частку успіху.
  rows.push({ run, id: c.id, modelId: "—", fields: false, pass: false, why: `${result.reason}: ${result.message}` });
  return false;
}

/** Вердикт судді для вільного тексту; undefined — кейс без rubric; "rate_limited" — суддя отримав 429. */
async function judgeCase(c: GoldenCase, view: ReturnType<typeof toProposalView>, answerModelId: string) {
  if (!c.rubric) return undefined;
  try {
    // Суддя — інша родина, ніж модель, що відповіла (judgeModelsFor; ADR 0013).
    return await judgeFreeText(makeJudgeModel(key, judgeModelsFor(answerModelId)), c.rubric, freeText(view));
  } catch (error) {
    // Суддя теж може отримати 429 чи не відповісти — кейс лишається у звіті з причиною.
    const failure = classifyError(error);
    if (failure.reason === "rate_limited") return "rate_limited" as const;
    return { pass: false, reason: `суддя: ${failure.reason}` };
  }
}

function fieldsWhy(mismatches: ReturnType<typeof scoreFields>["mismatches"]): string {
  if (mismatches.length === 0) return "";
  return `поля: ${mismatches.map((m) => `${m.field}=${JSON.stringify(m.actual)} (очікувано ${JSON.stringify(m.expected)})`).join(", ")}`;
}

function recording(result: Success): Recording {
  return {
    modelId: result.modelId,
    recordedAt: new Date().toISOString(),
    promptVersion: DRAFT_PROMPT_VERSION,
    text: JSON.stringify(ProposalSchema.parse(result.proposal)),
  };
}

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  // Частка успіху — лише з кейсів, що дістали відповідь; NOT RUN (ліміт) — окремо, не як FAIL і не мовчки.
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін golden cases — ${new Date().toISOString()}`,
    "",
    `- Промпт: \`${DRAFT_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}; суддя — інша родина, ніж відповідь: для Gemma ${judgeModelsFor(PRODUCT_MODELS[0]).map((m) => `\`${m}\``).join(" → ")}, для nemotron ${judgeModelsFor(JUDGE_MODEL).map((m) => `\`${m}\``).join(" → ")} (\`${JUDGE_PROMPT_VERSION}\`)`,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}${PARTIAL ? ` з ${allCases.length} (CASES=${cases.map((c) => c.id).join(",")})` : ""}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    thresholdLine(ran),
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | Модель | Поля | Суддя | Результат | Причина судді / помилка |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.run} | ${r.id} | \`${r.modelId}\` | ${r.fields ? "так" : "ні"} | ${r.judge === undefined ? "—" : r.judge ? "так" : "ні"} | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`,
    ),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}

// Поріг приймання PM ще не названо — тимчасово варіант A питання Q18 solomchaak/property-workflows-spec#55 (docs/spec-reading.md): ≥ 8 з 10, GC-09 і GC-10 — обов'язково.
const THRESHOLD = { passed: 8, mustPass: ["GC-09", "GC-10"] };
function thresholdLine(ran: Row[]): string {
  if (PARTIAL) return "- Поріг: не рахується — частковий прогін (CASES); підсумок разом із повним прогоном — у evals/reports/README.md";
  const last = new Map<string, Row>();
  for (const r of ran) last.set(r.id, r); // останній прогін кожного кейсу
  const passed = [...last.values()].filter((r) => r.pass).length;
  const missing = THRESHOLD.mustPass.filter((id) => !last.get(id)?.pass);
  const ok = passed >= THRESHOLD.passed && missing.length === 0;
  return `- Поріг (тимчасовий, Q18 варіант A — ≥ ${THRESHOLD.passed} з 10, ${THRESHOLD.mustPass.join(" і ")} обов'язково): ${ok ? "досягнуто" : "не досягнуто"} — ${passed} з ${last.size}${missing.length ? `; не пройшли обов'язкові: ${missing.join(", ")}` : ""}`;
}
