# Докази WS11 (знімки)

Знімки для перевірки курсу: канал алерту, трекер помилок і Vercel перевірка не відкриває. На знімках Telegram
зафарбовано назву групи (у ній ім'я) і її аватарку; токена бота й chat id у повідомленнях немає.

| Файл | Що доводить | Звідки |
|---|---|---|
| `ws11-alert-telegram.png` | B, C: червоний smoke деплою staging → алерт людині в Telegram (дріл 2026-11-23, 14:50 UTC) | [прогін 45198547199](https://github.com/yuriivynar/property-workflows/actions/runs/45198547199), [postmortem](../incidents/2026-11-23-staging-bad-supabase-url.md) |
| `ws11-error-tracker-telegram.png` | B: трекер помилок — `onRequestError` (`src/instrumentation.ts`) на staging надіслав маршрут, деплой, коміт і рядки стеку, без тексту помилки | навмисна помилка `GET /api/ops/error-test` під адміністратором на staging, 2026-11-24 |
| `ws11-llm-call-log.png` | B: рядок `llm.call` у Vercel Logs (staging) — модель, fallback, стан, затримка, токени, версія промпту; тексту документа й відповіді моделі немає | «Propose values» на staging, 2026-11-24 |
| `ws11-code-security.png` | D: Dependabot alerts і security updates, CodeQL default setup увімкнено | GitHub → Settings → Code security |
