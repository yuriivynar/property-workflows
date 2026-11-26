// Хто відкрив сторінку — з claims JWT і власного профілю (чиста функція; запити — у viewer.ts).

export interface Viewer {
  userId: string;
  /** Email з профілю (власний), інакше з JWT. */
  email: string | null;
  /** Роль із profiles (ніколи з user_metadata); null — профілю немає. */
  role: string | null;
  /** Шлях власного фото в бакеті avatars (ADR 0012); null — фото немає. */
  avatarPath: string | null;
}

type Profile = { email: string | null; role: string; avatar_url: string | null } | null;

export function toViewer(claims: { sub: string; email?: unknown }, profile: Profile): Viewer {
  const jwtEmail = typeof claims.email === "string" ? claims.email : null;
  return {
    userId: claims.sub,
    email: profile?.email ?? jwtEmail,
    role: profile?.role ?? null,
    avatarPath: profile?.avatar_url ?? null,
  };
}
