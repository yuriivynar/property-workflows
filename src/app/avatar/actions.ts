"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/require-role";
import { AVATAR_MESSAGES, avatarPath, checkAvatarFile } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

export type AvatarResult = { ok: boolean; message: string };

// Фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012). Вхід і роль — до запису (AGENTS.md); файл — PNG/JPG до
// 2 МБ; запис — клієнтом користувача під RLS storage (лише своя тека) і колонковим grant update (avatar_url).
export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) return { ok: false, message: AVATAR_MESSAGES.notSaved };

  const file = formData.get("photo");
  const check = checkAvatarFile(file instanceof File ? file : null);
  if (!check.ok || !(file instanceof File)) return { ok: false, message: check.ok ? AVATAR_MESSAGES.wrongType : check.message };

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.userId).maybeSingle();
  const path = avatarPath(user.userId, check.extension, Date.now());
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (uploadError) return { ok: false, message: AVATAR_MESSAGES.notSaved };

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.userId);
  if (updateError) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, message: AVATAR_MESSAGES.notSaved };
  }
  if (profile?.avatar_url) await supabase.storage.from("avatars").remove([profile.avatar_url]);

  revalidatePath("/", "layout");
  return { ok: true, message: AVATAR_MESSAGES.saved };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) return { ok: false, message: AVATAR_MESSAGES.notSaved };

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.userId).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.userId);
  if (error) return { ok: false, message: AVATAR_MESSAGES.notSaved };
  if (profile?.avatar_url) await supabase.storage.from("avatars").remove([profile.avatar_url]);

  revalidatePath("/", "layout");
  return { ok: true, message: AVATAR_MESSAGES.removed };
}
