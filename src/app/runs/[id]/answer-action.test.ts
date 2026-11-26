// Server action setRunFieldAnswer: вхід і роль — до запису (AGENTS.md), відмова — текст AC-LOGIC-05 на сторінці запуску.
// Next.js і Supabase замінено моками: redirect кидає виняток, як у Next.js, клієнт Supabase записує виклик rpc.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messageForError } from "@/lib/runs/domain";

const RUN = "10000000-0000-4000-8000-0000000000a1";
const OTHER_RUN = "10000000-0000-4000-8000-0000000000a2";
const FIELD = "10000000-0000-4000-8000-0000000000c1";
const ME = "10000000-0000-4000-8000-0000000000d1";
const MANAGER_A = "10000000-0000-4000-8000-0000000000d2";

const state = vi.hoisted(() => ({
  profile: { role: "manager" } as { role: string } | null,
  field: null as { run_id: string } | null,
  run: null as { run_manager_id: string } | null,
  rpc: vi.fn(async () => ({ error: null as { message: string } | null })),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: ME } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "profiles" ? state.profile : table === "run_fields" ? state.field : state.run,
            error: null,
          }),
        }),
      }),
    }),
    rpc: state.rpc,
  }),
}));

const { setRunFieldAnswer } = await import("./actions");

function form(runId: string, fieldId: string, answer: string) {
  const data = new FormData();
  data.set("run_id", runId);
  data.set("field_id", fieldId);
  data.set("answer", answer);
  return data;
}

const redirectOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

describe("setRunFieldAnswer", () => {
  beforeEach(() => {
    state.profile = { role: "manager" };
    state.field = { run_id: RUN };
    state.run = { run_manager_id: ME };
    state.rpc.mockClear();
    state.rpc.mockImplementation(async () => ({ error: null }));
  });

  it("AC-LOGIC-02: менеджер запуску відповідає «urgent» — set_run_field_answer викликано, повернення на сторінку запуску", async () => {
    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "urgent")))).toBe(`REDIRECT:/runs/${RUN}`);
    expect(state.rpc).toHaveBeenCalledWith("set_run_field_answer", { p_field_id: FIELD, p_answer: "urgent" });
  });

  it("AC-LOGIC-02: адміністратор відповідає на поле чужого запуску", async () => {
    state.profile = { role: "admin" };
    state.run = { run_manager_id: MANAGER_A };

    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "not urgent")))).toBe(`REDIRECT:/runs/${RUN}`);
    expect(state.rpc).toHaveBeenCalledOnce();
  });

  it("AC-LOGIC-05: менеджер B — не менеджер запуску — відмова до запису й текст «Only the run manager or an administrator can change the answers»", async () => {
    state.run = { run_manager_id: MANAGER_A };

    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "urgent")))).toBe(
      `REDIRECT:/runs/${RUN}?error=ANSWER_NOT_ALLOWED`,
    );
    expect(state.rpc).not.toHaveBeenCalled();
    expect(messageForError("ANSWER_NOT_ALLOWED")).toBe("Only the run manager or an administrator can change the answers");
  });

  it("AC-LOGIC-05: вендор (RLS не повертає ні поля, ні запуску) — відмова, rpc не викликано", async () => {
    state.profile = { role: "vendor" };
    state.field = null;
    state.run = null;

    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "urgent")))).toBe(
      `REDIRECT:/runs/${RUN}?error=ANSWER_NOT_ALLOWED`,
    );
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-LOGIC-05: відмова бази (ANSWER_NOT_ALLOWED) — той самий код на сторінці запуску", async () => {
    state.rpc.mockImplementation(async () => ({ error: { message: "ANSWER_NOT_ALLOWED" } }));

    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "urgent")))).toBe(
      `REDIRECT:/runs/${RUN}?error=ANSWER_NOT_ALLOWED`,
    );
  });

  it("поле з іншого запуску чи не-UUID — відмова, rpc не викликано", async () => {
    state.field = { run_id: OTHER_RUN };
    expect(await redirectOf(setRunFieldAnswer(form(RUN, FIELD, "urgent")))).toContain("ANSWER_NOT_ALLOWED");
    expect(await redirectOf(setRunFieldAnswer(form(RUN, "x", "urgent")))).toContain("ANSWER_NOT_ALLOWED");
    expect(await redirectOf(setRunFieldAnswer(form("x", FIELD, "urgent")))).toBe("REDIRECT:/runs");
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
