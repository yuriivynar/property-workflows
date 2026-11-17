// Content-Security-Policy для кожної відповіді (збирає src/proxy.ts; рев'ю безпеки 2026-11-17, знахідка 2).
// Чому в proxy, а не лише в next.config.ts: App Router вставляє в HTML вбудовані скрипти (потік RSC), а політика без
// 'unsafe-inline' їх заблокує. Тому скрипти дозволяє одноразовий nonce на запит (docs: content-security-policy.md);
// усі сторінки й так динамічні (cookies() у макеті). Решту заголовків безпеки — статично в next.config.ts.

type CspOptions = {
  /** Одноразове значення запиту: Next.js бере його з заголовка й ставить на свої вбудовані скрипти й стилі. */
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL — з нього беремо лише origin для connect-src. */
  supabaseUrl?: string;
  /** `next dev`: React і Turbopack потребують eval і websocket для HMR; у проді їх немає. */
  isDev?: boolean;
};

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ nonce, supabaseUrl, isDev = false }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic': скрипти, які довірений скрипт підвантажує сам (чанки Next.js), дозволені без переліку адрес.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Атрибут style="width: N%" у ProgressBar (відсоток відомий лише під час рендеру). Лише атрибути, не теги <style>.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // next/font/google самохостить шрифти: завантаження — з нашого origin.
    "font-src 'self'",
    ["connect-src 'self'", supabase, isDev ? "ws: wss:" : null].filter(Boolean).join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? null : "upgrade-insecure-requests",
  ];
  return directives.filter(Boolean).join("; ");
}

/** Новий nonce: 128 біт випадковості з Web Crypto (доступний у proxy), у base64. */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}
