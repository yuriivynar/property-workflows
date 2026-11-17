// Дії «Propose values» і «Save values» після перевірки входу (src/lib/documents/service.ts): роль — до виклику моделі
// й до запису. Модель — справжній MockLanguageModelV4 (рахує виклики), клієнт Supabase — простий об'єкт, що записує
// insert; власних модулів не мокаємо.
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { Proposal } from "@/lib/ai/schema";
import type { RoleCheck } from "@/lib/auth/require-role";
import { DOCUMENT_ERRORS } from "./form";
import { confirmValues, requestValues, type DocumentDeps } from "./service";
import { DOCUMENT_MESSAGES } from "./values";

const RUN = "10000000-0000-4000-8000-0000000000a1";
const ME = "a0000000-0000-0000-0000-000000000002";
const SOMEONE_ELSE = "a0000000-0000-0000-0000-000000000003";

const REQUEST: Proposal = {
  status: "ok",
  kind: "request",
  phone: "5550101",
  description: "Kitchen tap in apartment 12 has been dripping for three days",
  category: "plumbing",
  urgency: "not urgent",
  items: [],
  total: null,
  notes: [],
  twoProblems: false,
  instructionsIgnored: false,
};

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** Модель, що відповідає заданою пропозицією. */
const answering = (proposal: Proposal) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(proposal) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });

/** Модель, якої немає: денний ліміт безкоштовних запитів вичерпано. */
const rateLimited = () =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({
        message: "Rate limit exceeded: free-models-per-day",
        url: "https://openrouter.ai/api/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 429,
      });
    },
  });

/** Клієнт Supabase: запуск (під RLS — null, якщо його не видно) і insert, який записує рядок. */
function client(
  run: { run_manager_id: string } | null,
  insertError: { message: string } | null = null,
  slot: { data: string | null; error: { message: string } | null } = { data: "allowed", error: null },
) {
  const insert = vi.fn(async (row: unknown) => ({ error: insertError, row }));
  // rpc("take_ai_request") — ліміт запитів до моделі (private.take_ai_request у базі).
  const rpc = vi.fn<(name: string) => Promise<typeof slot>>(async () => slot);
  const supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: run, error: null }) }) }),
      insert,
    }),
    rpc,
  } as unknown as DocumentDeps["supabase"];
  return { supabase, insert, rpc };
}

const manager: RoleCheck = { ok: true, userId: ME, role: "manager" };
const admin: RoleCheck = { ok: true, userId: ME, role: "admin" };
const vendor: RoleCheck = { ok: true, userId: ME, role: "vendor" };
const noProfile: RoleCheck = { ok: false, reason: "NOT_ALLOWED" };

function parseForm(text: string, runId = RUN) {
  const data = new FormData();
  data.set("run_id", runId);
  data.set("document_text", text);
  return data;
}

const validRequest = {
  phone: "5550101",
  description: "Kitchen tap in apartment 12 has been dripping for three days",
  category: "plumbing",
  urgency: "not urgent",
};

function requestValuesForm(values: Record<string, string>) {
  const data = new FormData();
  data.set("run_id", RUN);
  data.set("kind", "request");
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("requestValues — «Propose values»", () => {
  it("AC-DOCAI-01: пропозиція моделі нічого не пише в базу; телефон — у формі коду", async () => {
    const { supabase, insert } = client({ run_manager_id: ME });
    const model = answering(REQUEST);
    const result = await requestValues({ supabase, user: manager, model }, parseForm("Hello, kitchen tap…"));
    expect(result).toMatchObject({ status: "proposed", view: { kind: "request", phone: "555-0101" } });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: вендор, користувач без профілю, менеджер чужого запуску — відмова, модель не викликано", async () => {
    for (const [user, run] of [
      [vendor, { run_manager_id: ME }],
      [noProfile, { run_manager_id: ME }],
      [manager, { run_manager_id: SOMEONE_ELSE }],
      [manager, null],
    ] as const) {
      const model = answering(REQUEST);
      const result = await requestValues({ supabase: client(run).supabase, user, model }, parseForm("Hello"));
      expect(result).toMatchObject({ status: "error", message: DOCUMENT_ERRORS.notAllowed });
      expect(model.doGenerateCalls).toHaveLength(0);
    }
  });

  it("AC-DOCAI-16: адміністратор розбирає документ будь-якого запуску", async () => {
    const model = answering(REQUEST);
    const result = await requestValues(
      { supabase: client({ run_manager_id: SOMEONE_ELSE }).supabase, user: admin, model },
      parseForm("Hello"),
    );
    expect(result.status).toBe("proposed");
  });

  it("AC-DOCAI-11: порожній текст чи не UUID запуску — помилка до виклику моделі", async () => {
    const model = answering(REQUEST);
    const { supabase } = client({ run_manager_id: ME });
    expect(await requestValues({ supabase, user: manager, model }, parseForm("   "))).toMatchObject({
      status: "error",
      message: DOCUMENT_ERRORS.emptyText,
    });
    expect(await requestValues({ supabase, user: manager, model }, parseForm("Hello", "run-1"))).toMatchObject({
      status: "error",
      message: DOCUMENT_ERRORS.notAllowed,
    });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("AC-DOCAI-13: немає ключа — «недоступний», текст лишається для ручного вводу", async () => {
    const result = await requestValues(
      { supabase: client({ run_manager_id: ME }).supabase, user: manager, model: null },
      parseForm("Hello, kitchen tap"),
    );
    expect(result).toEqual({ status: "unavailable", text: "Hello, kitchen tap", message: DOCUMENT_MESSAGES.unavailable });
  });

  it("AC-DOCAI-13: ліміт моделі — той самий стан «недоступний», без повторів у циклі", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = rateLimited();
    const result = await requestValues(
      { supabase: client({ run_manager_id: ME }).supabase, user: manager, model },
      parseForm("Hello, kitchen tap"),
    );
    expect(result).toMatchObject({ status: "unavailable", message: DOCUMENT_MESSAGES.unavailable });
    expect(model.doGenerateCalls.length).toBeLessThanOrEqual(2); // maxRetries 1
    // У лог — лише причина, без тексту документа.
    expect(warn).toHaveBeenCalledWith("document parsing unavailable: rate_limited");
    warn.mockRestore();
  });

  it("AC-DOCAI-13: вичерпаний ліміт користувача чи застосунку — «недоступний», модель не викликано, у лог — причина", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const reason of ["user_limit", "app_limit"]) {
      const model = answering(REQUEST);
      const { supabase, rpc } = client({ run_manager_id: ME }, null, { data: reason, error: null });
      const result = await requestValues({ supabase, user: manager, model }, parseForm("Hello, kitchen tap"));
      expect(result).toEqual({ status: "unavailable", text: "Hello, kitchen tap", message: DOCUMENT_MESSAGES.unavailable });
      expect(rpc).toHaveBeenCalledWith("take_ai_request");
      expect(model.doGenerateCalls).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(`document parsing unavailable: ${reason}`);
    }
    warn.mockRestore();
  });

  it("AC-DOCAI-13: збій самої перевірки ліміту — теж «недоступний», а не безкоштовний виклик моделі", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = answering(REQUEST);
    const { supabase } = client({ run_manager_id: ME }, null, { data: null, error: { message: "boom" } });
    const result = await requestValues({ supabase, user: manager, model }, parseForm("Hello"));
    expect(result).toMatchObject({ status: "unavailable", message: DOCUMENT_MESSAGES.unavailable });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith("document parsing unavailable: check_failed");
    warn.mockRestore();
  });

  it("AC-DOCAI-16: ліміт беремо лише після перевірки ролі — відмова й порожній текст не витрачають запитів", async () => {
    const denied = client({ run_manager_id: SOMEONE_ELSE });
    await requestValues({ supabase: denied.supabase, user: manager, model: answering(REQUEST) }, parseForm("Hello"));
    const empty = client({ run_manager_id: ME });
    await requestValues({ supabase: empty.supabase, user: manager, model: answering(REQUEST) }, parseForm("   "));
    expect(denied.rpc).not.toHaveBeenCalled();
    expect(empty.rpc).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-01: дозволений запит бере рівно один слот ліміту перед викликом моделі", async () => {
    const { supabase, rpc } = client({ run_manager_id: ME });
    const model = answering(REQUEST);
    await requestValues({ supabase, user: manager, model }, parseForm("Hello, kitchen tap"));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("AC-DOCAI-09: не звернення й не кошторис — лише текст відмови, без значень", async () => {
    const model = answering({ ...REQUEST, status: "refused", kind: null, phone: null, description: null, category: null, urgency: null });
    const result = await requestValues(
      { supabase: client({ run_manager_id: ME }).supabase, user: manager, model },
      parseForm("Dear tenants, the pool opens on Monday."),
    );
    expect(result).toEqual({
      status: "refused",
      text: "Dear tenants, the pool opens on Monday.",
      message: "This document is not a maintenance request or an estimate.",
    });
  });
});

describe("confirmValues — «Save values»", () => {
  it("AC-DOCAI-04: зберігає лише значення з форми людини (виправлений опис), телефон — у формі коду", async () => {
    const { supabase, insert } = client({ run_manager_id: ME });
    const result = await confirmValues(
      { supabase, user: manager },
      requestValuesForm({ ...validRequest, description: "Kitchen tap in apartment 12 drips (checked by phone)" }),
    );
    expect(result.status).toBe("saved");
    expect(insert).toHaveBeenCalledWith({
      run_id: RUN,
      kind: "request",
      fields: {
        phone: "555-0101",
        description: "Kitchen tap in apartment 12 drips (checked by phone)",
        category: "plumbing",
        urgency: "not urgent",
        notes: [],
      },
    });
  });

  it("AC-DOCAI-13: значення, введені вручну, коли помічник недоступний, зберігає лише «Save values»", async () => {
    const { supabase, insert } = client({ run_manager_id: ME });
    const data = new FormData();
    data.set("run_id", RUN);
    data.set("kind", "estimate");
    data.append("item_name", "Replace kitchen tap");
    data.set("item_quantity_0", "1");
    data.set("item_unit_price_0", "120");
    data.set("total", "130");
    expect((await confirmValues({ supabase, user: manager }, data)).status).toBe("saved");
    expect(insert).toHaveBeenCalledWith({
      run_id: RUN,
      kind: "estimate",
      fields: {
        items: [{ name: "Replace kitchen tap", quantity: 1, unitPrice: 120 }],
        total: 130,
        notes: [],
        warning: "items add up to 120.00, the stated total is 130.00",
      },
    });
  });

  it("AC-DOCAI-04: неповні значення — помилка, нічого не записано", async () => {
    const { supabase, insert } = client({ run_manager_id: ME });
    const result = await confirmValues({ supabase, user: manager }, requestValuesForm({ ...validRequest, category: "" }));
    expect(result).toEqual({ status: "error", message: DOCUMENT_ERRORS.invalidValues });
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: вендор чи менеджер чужого запуску — відмова до запису", async () => {
    const own = client({ run_manager_id: ME });
    const foreign = client({ run_manager_id: SOMEONE_ELSE });
    expect(await confirmValues({ supabase: own.supabase, user: vendor }, requestValuesForm(validRequest))).toEqual({
      status: "error",
      message: DOCUMENT_ERRORS.notAllowed,
    });
    expect(await confirmValues({ supabase: foreign.supabase, user: manager }, requestValuesForm(validRequest))).toEqual({
      status: "error",
      message: DOCUMENT_ERRORS.notAllowed,
    });
    expect(own.insert).not.toHaveBeenCalled();
    expect(foreign.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-04: збій бази — загальна помилка, а не «збережено»", async () => {
    const { supabase } = client({ run_manager_id: ME }, { message: "new row violates row-level security policy" });
    const result = await confirmValues({ supabase, user: manager }, requestValuesForm(validRequest));
    expect(result).toEqual({ status: "error", message: DOCUMENT_ERRORS.unexpected });
  });
});
