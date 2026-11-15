// AC-TASK-14: порядок списку запусків задає listRuns — та сама функція, яку викликає сторінка /runs (рев'ю WS6 №1).
import { describe, expect, it, vi } from "vitest";
import { listRuns, RUN_LIST_COLUMNS } from "./queries";

function fakeClient() {
  const calls = { from: vi.fn(), select: vi.fn(), order: vi.fn() };
  const chain = {
    select: (columns: string) => {
      calls.select(columns);
      return chain;
    },
    order: (column: string, options: unknown) => {
      calls.order(column, options);
      return chain;
    },
  };
  const client = {
    from: (table: string) => {
      calls.from(table);
      return chain;
    },
  };
  return { client: client as unknown as Parameters<typeof listRuns>[0], calls };
}

describe("listRuns", () => {
  it("AC-TASK-14: список запусків — з run_overview, найновіші вгорі (created_at спадно, далі id), з назвою випадку й шаблону", () => {
    const { client, calls } = fakeClient();
    listRuns(client);
    expect(calls.from).toHaveBeenCalledWith("run_overview");
    expect(calls.select).toHaveBeenCalledWith(RUN_LIST_COLUMNS);
    expect(RUN_LIST_COLUMNS).toContain("case_name");
    expect(RUN_LIST_COLUMNS).toContain("template_name");
    expect(calls.order.mock.calls).toEqual([
      ["created_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });
});
