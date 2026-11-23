// WS11, трек B: трекер помилок сервера (src/instrumentation.ts) шле в Telegram маршрут-шаблон, назву помилки й рядки
// стеку — і ніколи текст помилки, адресу з параметрами, заголовки чи cookie. Telegram не викликаємо: fetch — мок.
// Назви тестів без AC ID — технічна перевірка, а не критерій PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";

const USER_TEXT = "Tenant Olena Test, olena.test@example.test, phone 555-0101";
const MARKERS = ["Olena", "olena.test", "@example.test", "555-0101", "sb-access-token", "Bearer", "secret=1"];

const request = {
  path: `/runs/10000000-0000-4000-8000-0000000000a1?secret=1`,
  method: "GET",
  headers: { cookie: "sb-access-token=test", authorization: "Bearer test-token" },
};
const context = {
  routerKind: "App Router",
  routePath: "/runs/[id]",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
} as const;

describe("onRequestError → Telegram", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("надсилає маршрут-шаблон, назву помилки й стек без тексту помилки, параметрів запиту й заголовків", async () => {
    const error = new TypeError(USER_TEXT);
    await onRequestError(error, request, context);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.chat_id).toBe("test-chat");
    expect(body.text).toContain("ПОМИЛКА СЕРВЕРА");
    expect(body.text).toContain("GET /runs/[id]");
    expect(body.text).toContain("TypeError");
    expect(body.text).toMatch(/at .+:\d+:\d+/);
    for (const marker of MARKERS) expect(body.text).not.toContain(marker);
  });

  it("без TELEGRAM_BOT_TOKEN чи TELEGRAM_CHAT_ID нічого не надсилає", async () => {
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await onRequestError(new Error("other"), request, { ...context, routePath: "/templates" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("та сама помилка на тому самому маршруті — не частіше разу на хвилину", async () => {
    const route = { ...context, routePath: "/api/ops/error-test", routeType: "route" as const };
    await onRequestError(new RangeError("x"), request, route);
    await onRequestError(new RangeError("x"), request, route);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
