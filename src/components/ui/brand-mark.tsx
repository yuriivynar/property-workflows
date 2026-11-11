import { cn } from "cn"

// Логотип «Property workflows» (ADR 0008): плитка зі «сходинками» процесу і зеленою крапкою — колір «done». Під час
// завантаження сторінки сходинки один раз прокреслюються, крапка «вистрибує»; при наведенні чи фокусі посилання з
// логотипом крапка стрибає сходинками вгору (CSS brand-* у globals.css, вимикається prefers-reduced-motion).
// tone: "page" — на тлі сторінки (вхід), "hero" — на графітовій бічній панелі й смузі телефону.
function BrandMark({ tone, className }: { tone: "page" | "hero"; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      data-slot="brand-mark"
      data-tone={tone}
      className={cn("brand-mark shrink-0", className)}
    >
      <rect className="brand-tile" width="48" height="48" rx="14" />
      <path className="brand-step" d="M13 34h10V24h10V14" />
      <circle className="brand-start" cx="13" cy="34" r="3" />
      <circle className="brand-end" cx="33" cy="14" r="4.2" />
    </svg>
  )
}

export { BrandMark }
