// Пункти головної навігації за роллю — чисте правило (без Supabase), тестується окремо (src/lib/auth/nav.test.ts).

export type NavItem = { href: string; label: string };

/**
 * Навігація: вендору — лише «Runs» і «Profile» (AC-VENDOR-13; рішення PM solomchaak/property-workflows-spec#44):
 * сторінки шаблонів йому закриті, посилання завжди вело б до «Not enough rights» (AC-VENDOR-08, AC-VENDOR-14).
 * Іншим ролям — ще й «Templates». Прямий запит однаково відхиляють сторінка й RLS.
 */
export function navItems(role: string | null | undefined): NavItem[] {
  return [
    ...(role === "vendor" ? [] : [{ href: "/templates", label: "Templates" }]),
    { href: "/runs", label: "Runs" },
    { href: "/", label: "Profile" },
  ];
}
