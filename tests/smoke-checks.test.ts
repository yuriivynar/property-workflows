// Дія з postmortem 2026-11-23 (docs/incidents/2026-11-23-staging-bad-supabase-url.md): smoke червоніє, коли середовище
// ходить не в свою базу, і називає змінну. Дані — справжні відповіді /api/health з дрілу (публічні, без секретів).
// Назви тестів без AC ID — технічна перевірка, а не критерій PM.
import { describe, expect, it } from "vitest";
import { suspectEnvHint, supabaseRefProblem } from "../scripts/lib/smoke-checks.mjs";
import { suspectEnvFor } from "@/lib/health";

const STAGING = "ukbnybazjlbicejpfjvz";
const PROD = "lapdlcgusuahefesxfug";

// Червоний прогін дрілу 45198547199 і зелений після виправлення 45207624385.
const broken = { status: 503, ok: false, env: "preview", appEnv: "staging", supabaseRef: "ukbnybazjlbicejpfjvx", db: "down", reason: "status-0" };
const fixed = { status: 200, ok: true, env: "preview", appEnv: "staging", supabaseRef: STAGING, db: "ok", reason: "" };

describe("smoke: середовище ходить у свою базу", () => {
  it("червоніє на зламаному стані дрілу (ref …fjvx замість …fjvz) і називає NEXT_PUBLIC_SUPABASE_URL", () => {
    const problem = supabaseRefProblem(broken, STAGING);
    expect(problem).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(problem).toContain("ukbnybazjlbicejpfjvx");
    expect(problem).toContain(STAGING);
  });

  it("зеленіє на виправленому стані", () => {
    expect(supabaseRefProblem(fixed, STAGING)).toBeNull();
  });

  it("ловить preview, що ходить у прод-базу, і прод, що ходить у staging", () => {
    expect(supabaseRefProblem({ ...fixed, supabaseRef: PROD }, STAGING)).toContain("не на ту базу");
    expect(supabaseRefProblem({ ...fixed, env: "production", supabaseRef: STAGING }, PROD)).toContain("не на ту базу");
  });

  it("змінна не задана (supabaseRef: null) — теж збій; без очікуваного ref чи на старому деплої без поля — пропуск", () => {
    expect(supabaseRefProblem({ ...fixed, supabaseRef: null }, STAGING)).toContain("змінна не задана");
    expect(supabaseRefProblem(broken, "")).toBeNull();
    expect(supabaseRefProblem(broken, undefined)).toBeNull();
    const legacy: Record<string, unknown> = { ...fixed };
    delete legacy.supabaseRef;
    expect(supabaseRefProblem(legacy, STAGING)).toBeNull();
  });

  it("підказка з suspectEnv — лише назва змінної, сміття ігнорується", () => {
    expect(suspectEnvHint({ suspectEnv: "NEXT_PUBLIC_SUPABASE_URL" })).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(suspectEnvHint({ suspectEnv: "https://evil.example.test" })).toBe("");
    expect(suspectEnvHint({ suspectEnv: null })).toBe("");
  });
});

describe("/api/health: suspectEnv — яку змінну перевірити першою (лише назва)", () => {
  const env = { url: `https://${STAGING}.supabase.co`, key: "publishable-key-for-test" };

  it("стан дрілу (status-0) → NEXT_PUBLIC_SUPABASE_URL; хибний ключ → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", () => {
    expect(suspectEnvFor({ db: "down", reason: "status-0" }, env)).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(suspectEnvFor({ db: "down", reason: "exception" }, env)).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(suspectEnvFor({ db: "down", reason: "invalid-api-key" }, env)).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("порожня змінна — вона сама; база жива, на паузі чи 5xx Supabase — не змінна (null)", () => {
    expect(suspectEnvFor({ db: "down", reason: "exception" }, { ...env, url: undefined })).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(suspectEnvFor({ db: "down", reason: "exception" }, { ...env, key: " " })).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(suspectEnvFor({ db: "ok", reason: "" }, env)).toBeNull();
    expect(suspectEnvFor({ db: "down", reason: "paused" }, env)).toBeNull();
    expect(suspectEnvFor({ db: "down", reason: "status-503-PGRST002" }, env)).toBeNull();
  });

  it("значення змінних у відповідь не потрапляють — лише назва", () => {
    const name = suspectEnvFor({ db: "down", reason: "status-0" }, env);
    expect(name).not.toContain(STAGING);
    expect(name).not.toContain("publishable-key-for-test");
  });
});
