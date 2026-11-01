# QA proof pack: зріз 2 — дизайн-система й редактор шаблонів з версіями

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Покладіть у docs/qa/proof-pack.md вашого репо й заповнюйте по кроках WS8 (A → B → C → D).
Посилання — на файли на коміті (…/blob/<sha>/…#L<N>), на PR (…/pull/N) і на прогони (…/actions/runs/N).
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://property-workflows-eta.vercel.app
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-11-01
- `/api/health` на момент UAT: <!-- sha і db, напр. «sha 1a2b3c4, db ok, 01.11.2026» -->

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-EDITOR-07 | відмова в браузері (заборонена роль: менеджер на списку версій за прямим посиланням) | Then B sees the message "Not enough rights" and no versions. |
| AC-EDITOR-19 | стан інтерфейсу (помилка з дослівним текстом) | Then no template is created, and A sees the message "Enter a template name". |
| AC-EDITOR-09 | відмова в браузері (не увійшов: редактор за прямим посиланням) | Then the visitor sees the sign-in page and no content of the template. |

## A. Ворота

- PR воріт: <!-- …/pull/N -->
- Зелений `quality` на `main`: <!-- …/actions/runs/N -->
- Обов'язкові перевірки в `solo-main` з <!-- дата -->: <!-- назви jobs -->

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| Невикористані експорти `runStatusLabel`, `taskStatusLabel` (`src/lib/runs/domain.ts`) | 2 | справжня | Видалено: мертві з PR #13, друга мапа «статус → слово» поруч зі `StatusBadge` (загроза AC-DSYS-01). Покриття `runs/domain.ts` 91/85/87 → 100/94/100 % без нових тестів |
| Невикористані файли `ui/badge.tsx`, `ui/dialog.tsx`, `ui/select.tsx` | 3 | справжня | Видалено; DESIGN.md (розділ 5) узгоджено з кодом: підтвердження — на місці, без `Dialog`; статус — лише `StatusBadge`; `Select` — `npx shadcn add select`, коли знадобиться |
| Невикористаний файл `src/lib/supabase/client.ts` | 1 | навмисна | `fallow-ignore-file` з причиною: браузерний клієнт каркасу шаблону (AGENTS.md, «Структура») для першого клієнтського запиту до Supabase |
| Невикористаний файл `src/lib/utils.ts` | 1 | хибна | `fallow-ignore-file` з причиною: шлях alias `utils` у `components.json`, CLI shadcn імпортує його в нові компоненти; fallow `components.json` не читає |
| Невикористаний експорт `AC_ID_GLOBAL` (`scripts/lib/spec-lib.mjs`) | 1 | навмисна | `ignoreExports` у `.fallowrc.jsonc`: скрипт шаблону курсу, оновлюється лише cherry-pick'ом — правка розвела б його з шаблоном |
| Дублікат `src/app/globals.css` (30 рядків) | 1 | навмисна | Лишено: два однакові темні блоки за ADR 0004 (системна темна тема і обрана Dark; CSS не дає одного блоку для `@media` і `[data-theme]`) |
| Дублікати в `src/app/templates/actions.ts` | 4 | навмисна | Лишено: кожна Server Action явно робить «id → перевірка ролі (`adminClient`) → запис»; ADR 0003 і `check:actions` вимагають перевірки в кожній дії, спільний помічник сховав би її |
| Дублікат `runs/[id]/page.tsx` ↔ `runs/new/page.tsx` | 1 | навмисна | Лишено: `getClaims → /login` на кожній сторінці — другий рубіж після proxy (коментар у `src/lib/auth/access.ts`) |
| Дублікати в `scripts/check-*.mjs` | 3 | справжня | Лишено з поясненням: обхід файлів у наших архітектурних скриптах WS7; рефакторинг — окремим PR; ворота валять лише нові знахідки (`audit.gate: new-only`) |
| Складність: 7 сторінок + `launchRun` (CRITICAL/HIGH за CRAP) | 9 | хибна (оцінка) | Лишено: CRAP пораховано без файлу покриття; сторінки й дії Vitest за задумом не покриває — їх доводять тести бази (PGlite) та e2e |
| Складність у скриптах (`check-*`, `check-spec`, `create-demo-users`) | 16 | справжня | Лишено: скрипти шаблону й наші архітектурні перевірки поза кодом застосунку; ворота — new-only |

Тестові правила лінтера (`@vitest/eslint-plugin` 1.6.27, `eslint-plugin-playwright` 2.12.1) — у `eslint.config.mjs` як `error`; знахідок на наших тестах **0**.

Підлога покриття (`vitest.coverage.config.mts`, perFile 90/85/90/90): `auth/access`, `auth/require-role`, `runs/domain`, `theme`. Поза підлогою (гілки нижче 85 %): `templates/domain` (84 %), `templates/version` (79 %).

## B. Якість тестів

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-…-NN | <!-- політика / функція бази / TS-модуль / сторінка --> | <!-- unit / база (PGlite) / e2e --> | … | <!-- …/blob/<sha>/tests/…#L<N> --> |

### Покриття

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| <!-- src/lib/<модуль>.ts --> | … % | … % | — |
| <!-- src/app/<сторінка>/page.tsx --> | 0 % | 0 % | <!-- e2e: tests/e2e/….spec.ts --> |

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| <!-- src/lib/…/x.ts:14 `<=` → `<` --> | AC-…-NN | вижив | <!-- …/blob/<sha>/tests/…#L<N>: межа «…» з AC --> | убитий |

- Stryker: <!-- score до → після, посилання на PR з виводом -->
- SQL-мутації (`npm run mutation:sql`): <!-- таблиця з npm run mutation:sql -- --markdown (KILLED / SURVIVED / ERROR) з PR або «немає PGlite-гарнесу» -->
- Еквівалентні мутанти: <!-- який і чому (рядок міграції чи коду, що робить його еквівалентним) або «немає» -->

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-…-NN | <!-- …/blob/<sha>/tests/e2e/….spec.ts --> | <!-- passed / failed --> | <!-- Haiku: PASS / FAIL / NEEDS-HUMAN (+ Sonnet, якщо була суперечка) --> | <!-- PASS / FAIL / NEEDS-HUMAN і правило (R1–R6) --> | <!-- …/blob/<sha>/docs/qa/uat/<дата>/frames/AC-…-then-1.png --> |

- Звіт: <!-- …/blob/<sha>/docs/qa/uat/<YYYY-MM-DD>/report.md -->
- Відео: <!-- вкладення в описі PR …/pull/N -->
- Рецензент: <!-- моделі зі звіту (claude-haiku-5-5; суперечки — claude-sonnet-5-5) і вартість прогону -->
- Негативний контроль: <!-- NC-… (npm run uat:nc): що навмисно хибне, вердикт (FAIL / NEEDS-HUMAN), …/pull/N -->
- Дані: <!-- «лише читання» або «@writes: uat-<запуск>@example.test, рядок «Прибирання» зі звіту» -->

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-…-NN | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

## D. Eval рецензента

- PR з вадами (не злитий): <!-- …/pull/N -->
- Ключ і таблиця: <!-- …/pull/N#issuecomment-M -->

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | <!-- категорія і файл:рядок --> | <!-- знайшов / пропустив + цитата --> | <!-- знайшов / пропустив + цитата --> |
| 2 | … | … | … |
| 3 | … | … | … |
| П | приманка: <!-- що --> | <!-- хибна тривога? цитата --> | <!-- хибна тривога? цитата --> |

- Інші знахідки: <!-- слушна / шум, по рядку на кожну -->
- Правило, що закриває пропуск: <!-- рядок в AGENTS.md чи path instruction, …/commit/<sha> -->
- Повторний прогін: <!-- хто, результат, цитата, …/pull/N#issuecomment-M -->
