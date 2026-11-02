"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Сторінка, з якої відвідувача відправили на вхід (AC-DSYS-08); лише шлях цього застосунку.
  const next = safeNextPath(formData.get("next"));
  const back = next === "/" ? "" : `&next=${encodeURIComponent(next)}`;

  if (!email || !password) {
    redirect(`/login?error=missing${back}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect(`/login?error=invalid${back}`);
  }

  revalidatePath("/", "layout");
  // Вендор після входу без посилання — одразу на свою роботу, список запусків (основний сценарій вимоги
  // requirements/39-assign-a-vendor.md, крок 3; робоче рішення до solomchaak/property-workflows-spec#44).
  if (next === "/") {
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    const { data: profile } = userId
      ? await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
      : { data: null };
    if (profile?.role === "vendor") redirect("/runs");
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
