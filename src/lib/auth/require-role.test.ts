import { describe, expect, it } from "vitest";
import { signedInViewer } from "./require-role";

// Мінімальний клієнт Supabase: getClaims() і profiles.select("role").eq(…).maybeSingle() — те, що читає signedInViewer.
const client = (sub: string | undefined, role?: string) =>
  ({
    auth: { getClaims: async () => ({ data: sub ? { claims: { sub } } : null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role } : null }) }) }),
    }),
  }) as never;

describe("Хто відкрив сторінку (signedInViewer)", () => {
  it("AC-DSYS-03: без входу — null, і сторінка веде на вхід", async () => {
    expect(await signedInViewer(client(undefined))).toBeNull();
  });

  it("AC-VENDOR-14: вендор — id і роль vendor: сторінки запусків показують йому відмову чи його вигляд", async () => {
    expect(await signedInViewer(client("vendor-v", "vendor"))).toEqual({ userId: "vendor-v", role: "vendor" });
  });

  it("AC-VENDOR-14: без профілю — роль null, тобто не вендор; дані далі обмежує RLS", async () => {
    expect(await signedInViewer(client("user-x"))).toEqual({ userId: "user-x", role: null });
  });
});
