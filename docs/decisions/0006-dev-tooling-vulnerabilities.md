# 0006. Вразливості залежностей інструментів: `zod` оновлено до 4.6.7, `deepmerge` у CLI `shadcn` — прийнятий ризик

- Статус: прийнято
- Дата: 2026-10-28
- AC: — (безпека залежностей)

## Контекст

Після ADR 0005 `npm audit` показував:
- **high** — `zod` 4.6.5, GHSA-mrhx-c7xc-m3w5: вичерпання пам'яті під час перевірки надто великих колекцій з
  обмеженнями. Вразливі версії — `<4.6.6`. `zod` приходить транзитивно через `@fission-ai/openspec`, CLI `shadcn` і
  `eslint-plugin-react-hooks` (`eslint-config-next`). Застосунок `zod` не імпортує.
- **low** — `deepmerge` 4.3.1, GHSA-gcqx-w48m-w2h4: prototype poisoning у `mergeObject()`. Вразливі версії —
  `>=4.2.0 <=4.3.1`. Приходить через CLI `shadcn` і `@shadcn/registry`; аудит рахує ще 2 low — ці самі пакети.

## Рішення

- **`zod` → 4.6.7** — останній патч лінії 4.6; 4.6.6 — перша виправлена версія. Оновлено лише `package-lock.json`
  (`npm audit fix` без `--force`), `package.json` не змінюється, бо всі залежні пакети приймають `^4.x`. Записи
  `@emnapi/*`, які `npm` на Windows викидає, повернуто з lock-файлу `main`, і lock-файл перевірено чистим `npm ci`.
- **`deepmerge` — прийнятий ризик.** Виправленої версії немає: 4.3.1 — остання (березень 2023) і сама вразлива.
  Найновіші `shadcn` 4.23.0 і `@shadcn/registry` 0.2.1 так само вимагають `deepmerge ^4.3.1`. Пропозицію аудиту
  `shadcn@1.0.0` відкидаємо: це відкат на три мажорні версії зі зміною CLI. `shadcn` стоїть у `dependencies`, бо
  `src/app/globals.css` імпортує `shadcn/tailwind.css`. Але застосунок бере з пакета лише цей CSS, а код CLI з
  `deepmerge` у збірку не потрапляє: після `npm run build` у `.next/static` і `.next/server` немає жодного входження
  `deepmerge` чи `isMergeableObject`. Ризик стосується лише ручного запуску CLI `shadcn add` розробником.

## Розглянуті варіанти

- **`npm audit fix --force`** — чому ні: відкотив би `shadcn` до 1.0.0, а це ламає `npx shadcn@4.22.1 add …` з
  `AGENTS.md`.
- **`overrides` на `deepmerge` <4.2.0** — чому ні: `shadcn` вимагає `^4.3.1`; нижча версія — непідтримувана
  комбінація заради low-ризику в dev-інструменті.
- **Видалити `shadcn` із залежностей** — чому ні: CLI потрібен для нових компонентів дизайн-системи (`DESIGN.md`,
  розділ 5), а `globals.css` імпортує `shadcn/tailwind.css`.

## Наслідки

- `npm audit`: critical 0, high 0, low 3 — усі три з ланцюжка `deepmerge` через CLI `shadcn`.
- Коли вийде виправлений `deepmerge` або `shadcn` його позбудеться — оновити окремим PR і змінити статус цього ADR.

## Як перевіряємо

- `npm audit --json` → `metadata.vulnerabilities`: `high: 0`, `critical: 0`.
- Після `npm run build` у `.next/static` і `.next/server` немає `deepmerge` / `isMergeableObject`.
- `npx openspec --version` (1.14.1), `npm run spec:validate`, `npm run lint`, `npx shadcn@4.22.1 --version` працюють
  із `zod` 4.6.7; `npm run build` — `ƒ Proxy (Middleware)`.
