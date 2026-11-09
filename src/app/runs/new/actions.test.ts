// Server action launchRun: роль перевіряється до виклику launch_run (AGENTS.md, «Server Action перевіряє вхід і роль до
// першого запиту, що пише»). Next.js і Supabase замінено моками, як у src/app/runs/[id]/actions.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEMPLATE = "10000000-0000-4000-8000-0000000000c1";

const state = vi.hoisted(() => ({
  profile: { role: "vendor" } as { role: string } | null,
  rpc: vi.fn(async () => ({ data: "run-1", error: null })),
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
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }) }),
    }),
    rpc: state.rpc,
  }),
}));

const { launchRun } = await import("./actions");

function form() {
  const data = new FormData();
  data.set("template_id", TEMPLATE);
  data.set("case_name", "Apartment 16, move-in");
  data.set("expected_version", "1");
  return data;
}

const redirectOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: Error) => e.message,
  );

describe("launchRun", () => {
  beforeEach(() => {
    state.profile = { role: "vendor" };
    state.rpc.mockClear();
  });

  it("AC-VENDOR-09: вендор — LAUNCH_NOT_ALLOWED, launch_run не викликано", async () => {
    expect(await redirectOf(launchRun(form()))).toBe(`REDIRECT:/runs/new?template=${TEMPLATE}&error=LAUNCH_NOT_ALLOWED`);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-VENDOR-09: користувач без профілю з відомою роллю — LAUNCH_NOT_ALLOWED, launch_run не викликано", async () => {
    state.profile = null;

    expect(await redirectOf(launchRun(form()))).toBe(`REDIRECT:/runs/new?template=${TEMPLATE}&error=LAUNCH_NOT_ALLOWED`);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-01: менеджер — launch_run викликано, перехід на сторінку нового запуску", async () => {
    state.profile = { role: "manager" };

    expect(await redirectOf(launchRun(form()))).toBe("REDIRECT:/runs/run-1");
    expect(state.rpc).toHaveBeenCalledOnce();
  });
});
