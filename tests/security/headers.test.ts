// Заголовки безпеки (рев'ю безпеки 2026-11-17, знахідка 2): статичні — next.config.ts, Content-Security-Policy з nonce —
// src/lib/security/csp.ts (ставить src/proxy.ts). Тут — що політика містить і чого в ній немає.
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";

const SUPABASE = "https://abcdefghijklmnop.supabase.co";
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d === name || d.startsWith(`${name} `)) ?? "";

describe("next.config.ts: статичні заголовки", () => {
  it("X-Content-Type-Options: nosniff і Referrer-Policy: strict-origin-when-cross-origin — на всіх шляхах", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ]),
    );
  });

  it("X-Powered-By вимкнено", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("contentSecurityPolicy: прод", () => {
  const csp = contentSecurityPolicy({ nonce: "abc123", supabaseUrl: `${SUPABASE}/`, isDev: false });

  it("забороняє вбудовування в рамки й чужі джерела за замовчуванням", () => {
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("скрипти — лише свої й з nonce; без unsafe-eval і без unsafe-inline у script-src", () => {
    const script = directive(csp, "script-src");
    expect(script).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(script).not.toContain("unsafe-inline");
  });

  it("connect-src — свій origin, Supabase (лише origin, без шляху) і його Realtime (wss того самого хоста); шрифти — свої", () => {
    expect(directive(csp, "connect-src")).toBe(`connect-src 'self' ${SUPABASE} ${SUPABASE.replace("https:", "wss:")}`);
    expect(directive(csp, "font-src")).toBe("font-src 'self'");
  });

  it("inline-стилі дозволено лише як атрибути (смужка прогресу), теги <style> — з nonce", () => {
    expect(directive(csp, "style-src")).toBe("style-src 'self' 'nonce-abc123'");
    expect(directive(csp, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
  });

  it("без адреси Supabase чи з хибною — connect-src лише 'self'", () => {
    expect(directive(contentSecurityPolicy({ nonce: "n" }), "connect-src")).toBe("connect-src 'self'");
    expect(directive(contentSecurityPolicy({ nonce: "n", supabaseUrl: "not a url" }), "connect-src")).toBe("connect-src 'self'");
  });
});

describe("contentSecurityPolicy: розробка", () => {
  it("лише в next dev додає unsafe-eval і websocket для HMR, без upgrade-insecure-requests", () => {
    const dev = contentSecurityPolicy({ nonce: "n", isDev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});

describe("newNonce", () => {
  it("щоразу інший і придатний для 'nonce-…' (base64)", () => {
    const a = newNonce();
    const b = newNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
