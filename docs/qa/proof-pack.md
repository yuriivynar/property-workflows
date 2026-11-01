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
| AC-EDITOR-07 | політика `template_versions_select_admin_or_current` (`supabase/migrations/20261026133459_template_versions.sql`) + TS `templatePageAccess` (`src/lib/templates/domain.ts`) + сторінка `templates/[id]/versions` | база (PGlite) + unit + e2e | відмову «менеджер не бачить версій» тримає RLS — це доводить лише справжній SQL (мутант E07); роль → «Not enough rights» — розрахунок (unit); текст на сторінці — e2e | `tests/db/template-editor.test.ts#L86`, `#L116`; `src/lib/templates/domain.test.ts#L30` |
| AC-EDITOR-19 | TS `cleanName` (`src/lib/templates/domain.ts`) + дія `createTemplate`; останній рубіж — обмеження `templates_name_not_blank` | unit + база (PGlite) + e2e | правило двічі: TS дає повідомлення, SQL — межу в обхід дії; кожен шар зі своїми тестами (Stryker на `cleanName`, мутант E19 на обмеження); «Enter a template name» на формі — e2e | `src/lib/templates/domain.test.ts#L77`, `#L83`; `tests/db/template-clarify.test.ts#L151`; `src/app/templates/actions.test.ts#L121` |
| AC-EDITOR-09 | proxy `signInRedirect` (`src/lib/auth/access.ts`) + сторінка (`getClaims → /login`) + відсутність `grant` для `anon` | unit + база (PGlite) + e2e | редірект — розрахунок шляху (unit); «вмісту немає» навіть напряму — `anon` без прав (мутант E09); сторінка входу в браузері — e2e | `src/lib/auth/access.test.ts#L12`; `tests/db/template-editor.test.ts#L105`; `src/app/templates/actions.test.ts#L106` |

Посилання вище — у межах репо; на кроці здачі їх закріплено за SHA `main` (`…/blob/<sha>/…#L<N>`).

### Покриття

`npm run test:coverage` (v8; рядки / гілки):

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/lib/auth/access.ts` (AC-EDITOR-09) | 100 % | 100 % | — (у підлозі покриття) |
| `src/lib/templates/domain.ts` (AC-EDITOR-07, AC-EDITOR-19) | 95 % | 86 % (було 84 %) | — (statements 89,79 % — ще не в підлозі) |
| `src/app/templates/actions.ts` (AC-EDITOR-19, AC-EDITOR-09) | 78 % | 62 % | дії — тести з підробленим клієнтом Supabase (`actions.test.ts`) і e2e |
| `src/app/templates/[id]/versions/page.tsx` (AC-EDITOR-07) | 0 % | 0 % | база (RLS, E07) + e2e (крок C) |
| `src/app/templates/page.tsx` (AC-EDITOR-19) | 0 % | 0 % | e2e (крок C) |
| `src/app/templates/[id]/edit/page.tsx` (AC-EDITOR-09) | 0 % | 0 % | база (`anon` без прав, E09) + e2e (крок C) |
| `src/lib/supabase/proxy.ts` (AC-EDITOR-09) | 0 % | 0 % | логіка редіректу винесена в `access.ts` (100 %); сам proxy — e2e |

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/templates/domain.ts:119` `typeof value === "string"` → `true` | AC-EDITOR-19 | вижив | `src/lib/templates/domain.test.ts#L83`: «name empty» — і поле, якого форма не надіслала (`cleanName(null)`, `File`) | убитий |
| `src/lib/templates/domain.ts:119` запасне `""` → `"Stryker was here!"` | AC-EDITOR-19 | без покриття | той самий тест: без назви шаблон не створюється (інакше — назва-сміття) | убитий |
| SQL E19: `templates_name_not_blank` без `btrim` | AC-EDITOR-19 | вижив | `tests/db/template-clarify.test.ts#L151`: «Then no template is created» — назва `"   "` напряму в базу відхилена (`23514`), шаблону немає | убитий |

Перевірка «червоний на мутанті»: кожен мутант `domain.ts:119` внесено вручну тимчасово — новий тест падав, на справжньому коді зелений.

- Stryker (`npm run mutation:ts -- --mutate src/lib/templates/domain.ts,src/lib/auth/access.ts`): до — 85,34 % (21 вижив, 7 без покриття); після — `domain.ts` 80,45 → 81,95 %, усі 11 мутантів `cleanName` (рядки 118–121) убиті. На рядках AC-EDITOR-07 (`templatePageAccess`, 91–94) і AC-EDITOR-09 (`isPublicPath`/`signInRedirect`) вижилих не було й до посилення. Вижилі `access.ts:29,36` — `safeNextPath` (AC-DSYS-08), поза нашими 3 AC.
- Вижилі `domain.ts:80` (`23514` + `_name_not_blank` → `NAME_REQUIRED`, 6 мутантів): для AC-EDITOR-19 недосяжні з екрана — `cleanName` (JS `trim`) відсікає все, що відсік би `btrim` у Postgres, тож дія до бази з порожньою назвою не доходить, а прямий запит екрана не має. Побічна знахідка: якби цей шлях спрацював, текст був би «Enter a name», а не «Enter a template name» — записано для окремого виправлення.
- SQL-мутації (`npm run mutation:sql`): до — 2 з 3 (E19 SURVIVED); після — **3 з 3 вбито**:

| Мутант | AC | Що зламано | Вердикт | Який тест упав |
|---|---|---|---|---|
| E07 | AC-EDITOR-07 | політика template_versions: менеджер бачить усі версії збереженого шаблону, а не лише поточну | KILLED | AC-EDITOR-07: менеджер не бачить списку версій — лише поточну, жодної старої |
| E09 | AC-EDITOR-09 | відвідувач без входу (anon) отримує select на шаблони, розділи й задачі | KILLED | AC-EDITOR-09: відвідувач без входу не читає жодного вмісту шаблону й нічого не змінює |
| E19 | AC-EDITOR-19 | обмеження назви шаблону без btrim: назва лише з пробілів проходить базу | KILLED | AC-EDITOR-19: назва лише з пробілів напряму в базу, оминаючи дію, — шаблон не створено |

- Еквівалентні мутанти: немає. Про E09 чесно: без `grant` RLS однаково не віддала б анонімові рядків (політики `to authenticated`), тож мутант знімає один з двох рубежів; тест вимагає саме відмову в правах (`permission denied`), а не порожній результат.

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
