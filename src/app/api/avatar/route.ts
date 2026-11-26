import { createClient } from "@/lib/supabase/server";

// Власне фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012): віддає лише фото того, хто увійшов, — шлях беремо
// з його профілю, а не з адреси, тож чуже фото не отримати (AC-RUN-10, AC-TASK-11: інших — лише email). Читання —
// клієнтом користувача під RLS storage (лише своя тека). Кеш — приватний: фото не лягає в спільні кеші.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return new Response(null, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
  if (!profile?.avatar_url) return new Response(null, { status: 404 });

  const { data: file, error } = await supabase.storage.from("avatars").download(profile.avatar_url);
  if (error || !file) return new Response(null, { status: 404 });

  return new Response(file, {
    headers: {
      "Content-Type": file.type || "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
