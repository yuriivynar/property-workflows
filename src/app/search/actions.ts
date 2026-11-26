"use server";

import { currentUser } from "@/lib/auth/require-role";
import { formatProgress } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

export type SearchItem = { group: "Runs" | "Templates" | "Actions"; label: string; hint: string; href: string };

// Дані палітри ⌘K (UI v3, рішення власника 2026-11-26, ADR 0012): запуски й шаблони, які користувач і так бачить (RLS;
// вендору — лише його запуски через vendor_runs, без шаблонів), і дії за роллю. Лише читання; вхід — до запитів.
export async function searchIndex(): Promise<SearchItem[]> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) return [];

  const profile: SearchItem = { group: "Actions", label: "Open your profile", hint: "Action", href: "/" };
  if (user.role === "vendor") {
    const { data: runs } = await supabase.rpc("vendor_runs");
    return [
      ...(runs ?? []).map((run) => ({
        group: "Runs" as const,
        label: run.case_name,
        hint: `Your tasks: ${formatProgress(run.my_done, run.my_total)}`,
        href: `/runs/${run.id}`,
      })),
      profile,
    ];
  }

  const [{ data: runs }, { data: templates }] = await Promise.all([
    supabase.from("run_overview").select("id, case_name, done_count, total_count").order("created_at", { ascending: false }).limit(50),
    supabase.from("templates").select("id, name").order("name"),
  ]);
  return [
    ...(runs ?? []).map((run) => ({
      group: "Runs" as const,
      label: run.case_name ?? "",
      hint: formatProgress(run.done_count ?? 0, run.total_count ?? 0),
      href: `/runs/${run.id}`,
    })),
    ...(templates ?? []).map((template) => ({
      group: "Templates" as const,
      label: template.name,
      hint: "Template",
      href: `/templates/${template.id}`,
    })),
    { group: "Actions", label: "Launch a template", hint: "Action", href: "/runs/new" },
    profile,
  ];
}
