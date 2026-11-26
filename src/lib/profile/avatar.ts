// Фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012): правила файлу й шлях у бакеті — чистий TypeScript.
// Остаточно межу розміру й типу тримає й бакет avatars (file_size_limit, allowed_mime_types), а теку — RLS storage.

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

export const AVATAR_MESSAGES = {
  wrongType: "Choose a PNG or JPG image",
  tooLarge: "The photo must be at most 2 MB",
  saved: "Photo saved",
  removed: "Photo removed",
  notSaved: "The photo was not saved. Try again.",
} as const;

export type AvatarCheck = { ok: true; extension: string } | { ok: false; message: string };

/** PNG або JPG, не порожній, до 2 МБ. */
export function checkAvatarFile(file: { type: string; size: number } | null | undefined): AvatarCheck {
  const extension = file ? AVATAR_TYPES[file.type] : undefined;
  if (!file || !extension || file.size === 0) return { ok: false, message: AVATAR_MESSAGES.wrongType };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, message: AVATAR_MESSAGES.tooLarge };
  return { ok: true, extension };
}

/** Шлях об'єкта — лише у власній теці «<id>/» (як вимагають check profiles_avatar_url_own_folder і RLS storage). */
export function avatarPath(userId: string, extension: string, now: number): string {
  return `${userId}/avatar-${now}.${extension}`;
}

/** Адреса власного фото для <img>: через свій маршрут /api/avatar (чужого він не віддасть), v — щоб оновився кеш. */
export function avatarSrc(path: string | null | undefined): string | null {
  return path ? `/api/avatar?v=${encodeURIComponent(path)}` : null;
}
