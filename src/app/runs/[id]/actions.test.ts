// Server action markTaskDone: перевірки до виклику RPC (рев'ю PR #6 і PR #11). Next.js і Supabase замінено моками:
// redirect кидає виняток, як у Next.js, а клієнт Supabase записує, чи викликано mark_task_done.
import { beforeEach, describe, expect, it, vi } from "vitest";

const RUN = "10000000-0000-4000-8000-0000000000a1";
const OTHER_RUN = "10000000-0000-4000-8000-0000000000a2";
const TASK = "10000000-0000-4000-8000-0000000000b1";

const state = vi.hoisted(() => ({
  task: null as { run_id: string } | null,
  selectError: null as { message: string } | null,
  rpc: vi.fn(async () => ({ error: null })),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.task, error: state.selectError }) }),
      }),
    }),
    rpc: state.rpc,
  }),
}));

const { markTaskDone } = await import("./actions");

function form(runId: string, taskId: string) {
  const data = new FormData();
  data.set("run_id", runId);
  data.set("task_id", taskId);
  return data;
}

const redirectOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

describe("markTaskDone", () => {
  beforeEach(() => {
    state.task = null;
    state.selectError = null;
    state.rpc.mockClear();
  });

  it("AC-TASK-03: задача з іншого запуску — NOT_ALLOWED на сторінці запуску з форми, mark_task_done не викликано", async () => {
    state.task = { run_id: OTHER_RUN };

    expect(await redirectOf(markTaskDone(form(RUN, TASK)))).toBe(`REDIRECT:/runs/${RUN}?error=NOT_ALLOWED`);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-TASK-03: невидима задача (RLS не повернула рядок) — NOT_ALLOWED, mark_task_done не викликано", async () => {
    expect(await redirectOf(markTaskDone(form(RUN, TASK)))).toBe(`REDIRECT:/runs/${RUN}?error=NOT_ALLOWED`);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-TASK-03: помилка читання задачі — UNEXPECTED, а не NOT_ALLOWED; mark_task_done не викликано", async () => {
    state.selectError = { message: "network" };

    expect(await redirectOf(markTaskDone(form(RUN, TASK)))).toBe(`REDIRECT:/runs/${RUN}?error=UNEXPECTED`);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-TASK-01: задача цього запуску — mark_task_done викликано, повернення на сторінку запуску", async () => {
    state.task = { run_id: RUN };

    expect(await redirectOf(markTaskDone(form(RUN, TASK)))).toBe(`REDIRECT:/runs/${RUN}`);
    expect(state.rpc).toHaveBeenCalledWith("mark_task_done", { p_task_id: TASK, p_confirmed: false });
  });
});
