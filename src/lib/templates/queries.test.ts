// Позначку «Unpublished changes» сторінки шаблонів беруть лише в адміністратора (AC-EDITOR-01, AC-EDITOR-29).
import { describe, expect, it, vi } from "vitest";
import { unpublishedTemplateIds } from "./queries";

function fakeClient(rows: { id: string }[], error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data: error ? null : rows, error }));
  return { client: { rpc } as unknown as Parameters<typeof unpublishedTemplateIds>[0], rpc };
}

describe("unpublishedTemplateIds", () => {
  it("AC-EDITOR-01: адміністратору — шаблони з незбереженими змінами з templates_with_unpublished_changes()", async () => {
    const { client, rpc } = fakeClient([{ id: "t-1" }, { id: "t-2" }]);
    const ids = await unpublishedTemplateIds(client, true);
    expect(rpc).toHaveBeenCalledWith("templates_with_unpublished_changes");
    expect([...ids]).toEqual(["t-1", "t-2"]);
  });

  it("AC-EDITOR-29: менеджеру позначку не запитуємо зовсім — порожньо", async () => {
    const { client, rpc } = fakeClient([{ id: "t-1" }]);
    expect((await unpublishedTemplateIds(client, false)).size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-EDITOR-01: помилка функції бази — не «змін немає»: помилку кинуто далі, а не повернуто порожньо", async () => {
    const { client } = fakeClient([], { message: "connection lost" });
    await expect(unpublishedTemplateIds(client, true)).rejects.toMatchObject({ message: "connection lost" });
  });
});

