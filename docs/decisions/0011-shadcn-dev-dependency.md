# 0011. `shadcn` (CLI) — у `devDependencies`: прод-залежності без зауважень `npm audit`

- Статус: прийнято (уточнює 0006: там `shadcn` стояв у `dependencies`)
- Дата: 2026-11-17
- AC: — (безпека залежностей, рев'ю безпеки й архітектури 2026-11-17, знахідка 10)

## Контекст

`shadcn` 4.22.1 стояв у `dependencies`, тому `npm audit --omit=dev` показував 6 зауважень рівня **moderate**
(`hono` ×4 через MCP-залежності CLI, `minimatch` → `@ts-morph/common` → `ts-morph` → `shadcn`). У застосунку з пакета
використовується лише CSS: `src/app/globals.css` має `@import "shadcn/tailwind.css"`, який Tailwind розв'язує **під час
збірки**; код CLI під час роботи сервера не завантажується (ADR 0006: усі файли трасування `*.nft.json` без `shadcn`).

Збірка вже залежить від `devDependencies`: `tailwindcss` і `@tailwindcss/turbopack` теж лежать там, а Vercel за
замовчуванням ставить `devDependencies` перед `next build` — інакше не зібралося б нічого. Тож `shadcn/tailwind.css`
розв'язується з тим самим `node_modules`, що й `tailwindcss`.

## Рішення

- `shadcn` **4.22.1** (точна версія, без змін) — з `dependencies` у `devDependencies`. `@import "shadcn/tailwind.css"`
  лишається як є.
- `package-lock.json` перегенеровано `npm@11.19.1` (та сама версія, що в CI): змінилися лише рядок `shadcn` у
  кореневому записі та позначки `"dev": true` на пакетах його піддерева (312 рядків); версій пакетів не змінено.
- ADR 0006 лишається чинним щодо `deepmerge` (прийнятий ризик) і меж довіри CLI; змінюється лише його твердження
  «`shadcn` стоїть у `dependencies`».

## Розглянуті варіанти

- **Скопіювати `tailwind.css` (≈16 КБ) у `globals.css` і прибрати залежність від збірки** — чому ні: це копія стилів
  стороннього пакета, яка розійдеться з версією CLI, що генерує компоненти (`npx shadcn@4.22.1 add …` розраховує на
  його утиліти); виграш той самий, що й від переносу в `devDependencies`, а підтримка дорожча.
- **Лишити в `dependencies`** — чому ні: прод-аудит показує 6 зауважень у пакеті, якого сервер не завантажує.
- **`npm audit fix --force`** — чому ні: відкат `shadcn` до 1.0.0 (так само відкинуто в ADR 0006).

## Наслідки

- `npm audit --omit=dev` → **0 зауважень** (було 6 moderate). Повний `npm audit` показує ті самі пакети як
  dev-інструменти (`hono`, `minimatch` тощо) — їх стосується ADR 0006: вони не потрапляють у збірку застосунку.
- Якщо хост колись вимкне встановлення `devDependencies` на збірці, зламається не лише цей імпорт, а й Tailwind, тож
  це не новий ризик; перевірка — Vercel Preview кожного PR.
- Нові залежності, що потрібні лише збірці чи інструментам, — одразу в `devDependencies`.

## Як перевіряємо

- `npm audit --omit=dev --json` → `metadata.vulnerabilities.total` = 0.
- `npm run build` показує `ƒ Proxy (Middleware)`; після нього
  `find .next -name '*.nft.json' -exec grep -lE 'deepmerge|hono|minimatch|ts-morph|node_modules/(shadcn|zod)/' {} + | wc -l`
  = 0 за 16 файлів трасування, а позитивний контроль (`node_modules/next/`) знаходить усі 16.
- CI (`app`) виконує `npm ci` з цим lock-файлом; Vercel Preview PR збирає CSS з `shadcn/tailwind.css`.
