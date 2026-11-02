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
- `/api/health` на момент UAT: sha `43157b6`, db ok, 02.11.2026

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-EDITOR-07 | відмова в браузері (заборонена роль: менеджер на списку версій за прямим посиланням) | Then B sees the message "Not enough rights" and no versions. |
| AC-EDITOR-19 | стан інтерфейсу (помилка з дослівним текстом) | Then no template is created, and A sees the message "Enter a template name". |
| AC-EDITOR-09 | відмова в браузері (не увійшов: редактор за прямим посиланням) | Then the visitor sees the sign-in page and no content of the template. |

## A. Ворота

- PR воріт: https://github.com/yuriivynar/property-workflows/pull/37
- Зелений `quality` на `main`: https://github.com/yuriivynar/property-workflows/actions/runs/41360940284 (`43157b6`)
- Обов'язкові перевірки в `solo-main` з 02.11.2026: «Ворота: fallow audit», «Покриття: доменна підлога» (поруч із `spec`, `app`, `conformance`, `db-check`; «Порада: вразливі залежності» — навмисно не обов'язкова)

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

Підлога покриття (`vitest.coverage.config.mts`, perFile 90/85/90/90): `auth/access`, `auth/require-role`, `runs/domain`, `templates/domain` (з WS8 B, після тестів AC-EDITOR-19 на помилку бази), `theme`. Поза підлогою (гілки нижче 85 %): `templates/version` (79 %).

## B. Якість тестів

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-EDITOR-07 | політика `template_versions_select_admin_or_current` (`supabase/migrations/20261026133459_template_versions.sql`) + TS `templatePageAccess` (`src/lib/templates/domain.ts`) + сторінка `templates/[id]/versions` | база (PGlite) + unit + e2e | відмову «менеджер не бачить версій» тримає RLS — це доводить лише справжній SQL (мутант E07); роль → «Not enough rights» — розрахунок (unit); текст на сторінці — e2e | [`tests/db/template-editor.test.ts#L86`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/tests/db/template-editor.test.ts#L86), [`#L116`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/tests/db/template-editor.test.ts#L116); [`src/lib/templates/domain.test.ts#L30`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/lib/templates/domain.test.ts#L30) |
| AC-EDITOR-19 | TS `cleanName` (`src/lib/templates/domain.ts`) + дія `createTemplate`; останній рубіж — обмеження `templates_name_not_blank` | unit + база (PGlite) + e2e | правило двічі: TS дає повідомлення, SQL — межу в обхід дії; кожен шар зі своїми тестами (Stryker на `cleanName`, мутант E19 на обмеження); «Enter a template name» на формі — e2e | [`src/lib/templates/domain.test.ts#L77`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/lib/templates/domain.test.ts#L77), [`#L83`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/lib/templates/domain.test.ts#L83); [`tests/db/template-clarify.test.ts#L151`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/tests/db/template-clarify.test.ts#L151); [`src/app/templates/actions.test.ts#L121`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/app/templates/actions.test.ts#L121) |
| AC-EDITOR-09 | proxy `signInRedirect` (`src/lib/auth/access.ts`) + сторінка (`getClaims → /login`) + відсутність `grant` для `anon` | unit + база (PGlite) + e2e | редірект — розрахунок шляху (unit); «вмісту немає» навіть напряму — `anon` без прав (мутант E09); сторінка входу в браузері — e2e | [`src/lib/auth/access.test.ts#L12`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/lib/auth/access.test.ts#L12); [`tests/db/template-editor.test.ts#L105`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/tests/db/template-editor.test.ts#L105); [`src/app/templates/actions.test.ts#L106`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/app/templates/actions.test.ts#L106) |

Посилання на тести закріплено за SHA `main` `11af9e5`.

### Покриття

`npm run test:coverage` (v8; рядки / гілки):

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/lib/auth/access.ts` (AC-EDITOR-09) | 100 % | 100 % | — (у підлозі покриття) |
| `src/lib/templates/domain.ts` (AC-EDITOR-07, AC-EDITOR-19) | 95 % | 91 % (було 84 %) | — (у підлозі з WS8 B: statements 91,8 %) |
| `src/app/templates/actions.ts` (AC-EDITOR-19, AC-EDITOR-09) | 78 % | 62 % | дії — тести з підробленим клієнтом Supabase (`actions.test.ts`) і e2e |
| `src/app/templates/[id]/versions/page.tsx` (AC-EDITOR-07) | 0 % | 0 % | база (RLS, E07) + e2e (крок C) |
| `src/app/templates/page.tsx` (AC-EDITOR-19) | 0 % | 0 % | e2e (крок C) |
| `src/app/templates/[id]/edit/page.tsx` (AC-EDITOR-09) | 0 % | 0 % | база (`anon` без прав, E09) + e2e (крок C) |
| `src/lib/supabase/proxy.ts` (AC-EDITOR-09) | 0 % | 0 % | логіка редіректу винесена в `access.ts` (100 %); сам proxy — e2e |

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/templates/domain.ts:119` `typeof value === "string"` → `true` | AC-EDITOR-19 | вижив | [`src/lib/templates/domain.test.ts#L83`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/src/lib/templates/domain.test.ts#L83): «name empty» — і поле, якого форма не надіслала (`cleanName(null)`, `File`) | убитий |
| `src/lib/templates/domain.ts:119` запасне `""` → `"Stryker was here!"` | AC-EDITOR-19 | без покриття | той самий тест: без назви шаблон не створюється (інакше — назва-сміття) | убитий |
| SQL E19: `templates_name_not_blank` без `btrim` | AC-EDITOR-19 | вижив | [`tests/db/template-clarify.test.ts#L151`](https://github.com/yuriivynar/property-workflows/blob/11af9e5fab1ecc8c342acf6fed13db37e2e7d28a/tests/db/template-clarify.test.ts#L151): «Then no template is created» — назва `"   "` напряму в базу відхилена (`23514`), шаблону немає | убитий |

Перевірка «червоний на мутанті»: кожен мутант `domain.ts:119` внесено вручну тимчасово — новий тест падав, на справжньому коді зелений.

- Stryker (`npm run mutation:ts -- --mutate src/lib/templates/domain.ts,src/lib/auth/access.ts`, той самий набір файлів до і після): до — **85,34 %** (21 вижив, 7 без покриття); після — **89,58 %** (172 убито, 15 вижило, 5 без покриття; `domain.ts` 86,57 %, `access.ts` 96,55 %). Усі 11 мутантів `cleanName` (рядки 118–121) і всі мутанти правила назви шаблону в `templateErrorCode` (рядки 82–84) убиті. На рядках AC-EDITOR-07 (`templatePageAccess`) і AC-EDITOR-09 (`isPublicPath`/`signInRedirect`) вижилих не було й до посилення. Вижилі `access.ts:29,36` — `safeNextPath` (AC-DSYS-08), а `domain.ts:40–85` поза правилом назви — інші коди помилок (AC-EDITOR-04, -08, -23), поза нашими 3 AC.
- Колишні вижилі `domain.ts:80` (`23514` + `_name_not_blank` → `NAME_REQUIRED`, 6 мутантів) вказали на справжню ваду: коли назву шаблону лише з пробілів відхиляла сама база (прямий запит в обхід дії), людина побачила б «Enter a name», а не «Enter a template name» з AC-EDITOR-19. Обмеження назви в базі лишились лише для назви шаблону (`templates`, `template_draft_names`), тож правило тепер повертає `TEMPLATE_NAME_REQUIRED`. Тести з тексту AC («Then … A sees the message "Enter a template name"»): юніт — `src/lib/templates/domain.test.ts` («назву лише з пробілів відхилила база»), база — `tests/db/template-clarify.test.ts` (справжня помилка Postgres → текст). На старому коді обидва червоні («Enter a name»).
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
| AC-EDITOR-07 | [template-versions-forbidden.spec.ts](../../tests/e2e/template-versions-forbidden.spec.ts) | passed | Haiku: PASS | PASS, R6 | [AC-EDITOR-07-then-1.png](uat/2026-11-02/frames/AC-EDITOR-07-then-1.png) |
| AC-EDITOR-09 | [template-editor-signed-out.spec.ts](../../tests/e2e/template-editor-signed-out.spec.ts) | passed | Haiku: PASS | PASS, R6 | [AC-EDITOR-09-then-1.png](uat/2026-11-02/frames/AC-EDITOR-09-then-1.png) |
| AC-EDITOR-19 | [template-name-required.spec.ts](../../tests/e2e/template-name-required.spec.ts) | passed | Haiku: PASS | PASS, R6 | [then-1](uat/2026-11-02/frames/AC-EDITOR-19-then-1.png), [then-2](uat/2026-11-02/frames/AC-EDITOR-19-then-2.png) |

Перший прогін того самого дня дав AC-EDITOR-07 **FAIL (R1)** на кроці «Дано»: вада тесту, не продукту — `hasText: /^Version 1\b/` на рядку таблиці, а Playwright склеює текст комірок без пробілів («Version 127.10.2026…»), тож `\b` не збігався. Виправлено пошуком комірки «Version N» (коміт у PR UAT); повторний прогін — 3 × PASS. Перевірка «Дано» спрацювала як задумано: тест не пройшов на непідтвердженій передумові.

- Звіт: [report.md](uat/2026-11-02/report.md), [manifest.json](uat/2026-11-02/manifest.json)
- Відео: вкладення в описі https://github.com/yuriivynar/property-workflows/pull/40
- Рецензент: `claude-haiku-5-5`, суперечки — `claude-sonnet-5-5`; розбір $0.0063 (UAT) + $0.0433 (негативні контролі)
- Негативний контроль (https://github.com/yuriivynar/property-workflows/pull/40, `npm run uat:nc`, [negative-controls.spec.ts](../../tests/e2e/negative-controls.spec.ts), обидва на AC-EDITOR-07):
  - NC-1 — у тесті хибний текст («You do not have access to versions»): перевірка впала → **FAIL (R1)**, хоч Haiku на кадрі й бачив «Not enough rights» (PASS) — агент не перекриває твердження;
  - NC-2 — «Тоді» в анотації `ac-text` уточнено до «Only administrators can see versions», тест і застосунок — ні: перевірки зелені, Haiku FAIL → Sonnet FAIL → **NEEDS-HUMAN (R3)**.
- Дані: лише читання (AC-EDITOR-19 не створює шаблону за самим AC); «Прибирання»: видалено 0, лишилось 0

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-…-NN | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

## D. Eval рецензента

- PR з вадами (не злитий, закритий): https://github.com/yuriivynar/property-workflows/pull/41
- Ключ і таблиця: https://github.com/yuriivynar/property-workflows/pull/41#issuecomment-6574406386 (виправлення щодо pre-merge checks CodeRabbit — у коментарі повторного прогону)
- Рецензенти: CodeRabbit (ASSERTIVE, `.coderabbit.yaml`); `/code-review high 41` через `claude -p … --setting-sources project --output-format json` — моделі `claude-opus-5-5` + `claude-haiku-5-5`, 94 с і $0.92 (перший), 74 с і $0.91 (повторний)

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | права в даних — [`supabase/migrations/20261102095213_run_task_counts.sql:4-16`](https://github.com/yuriivynar/property-workflows/blob/111e355db28344a6d08658ae2ad61df3783fcf46/supabase/migrations/20261102095213_run_task_counts.sql#L4-L16): `public.run_task_counts` — `security definer` у `public`, без `set search_path = ''`, без перевірки доступу до запуску, `execute` не відкликано | знайшов: inline Major (CWE-862) «не перевіряє доступ до `p_run_id` … успадковує `EXECUTE` для `PUBLIC`»; pre-merge «міграції: Rls, Grant і політики» — «Порушено правило для security definer … у схемі `public` і не має `set search_path = ''`» | знайшов, серйозна: «Функція має `security definer`, тож обходить RLS. Вона не перевіряє, чи має користувач доступ до запуску (`private.can_see_run`) … лежить у схемі `public` без `set search_path = ''`, що суперечить правилу в `AGENTS.md`» |
| 2 | авторизація в дії — [`src/app/templates/actions.ts:161`](https://github.com/yuriivynar/property-workflows/blob/111e355db28344a6d08658ae2ad61df3783fcf46/src/app/templates/actions.ts#L161) (`setTaskRequired`): запис до `adminClient()`/`requireAdmin` | знайшов, але inline лише **Minor** (Data Integrity) через кеш: «Зміна вже залишиться в базі, а `done` не виконає інвалідацію кешу. RLS наразі обмежує запис адміністратором»; pre-merge «Proxy і Getclaims» — «Виявлено порушення авторизації … перевірка не є першою операцією перед записом» | знайшов, серйозна: «`requireAdmin` тепер викликається після запису, а за інваріантом файлу (рядок 10, AC-EDITOR-08) має бути першим кроком. Зараз запис від менеджера зупиняє лише RLS» |
| 3 | тести — [`tests/db/run-progress.test.ts:120`](https://github.com/yuriivynar/property-workflows/blob/111e355db28344a6d08658ae2ad61df3783fcf46/tests/db/run-progress.test.ts#L120): «task stays to do» перевіряє `tasks[1]`, а не `taskOfB` | знайшов, Major: «Виклик `mark` змінює `taskOfB.id`, але твердження перевіряє `tasks[1].id` … Тест може пройти навіть після регресії авторизації» | знайшов, серйозна: «Тест дивиться на `tasks[1]`, якої ніхто не чіпає, замість `taskOfB`. Якщо ця регресія з'явиться, тест її не впіймає» |
| П | приманка: [`src/app/runs/[id]/actions.ts`](https://github.com/yuriivynar/property-workflows/blob/111e355db28344a6d08658ae2ad61df3783fcf46/src/app/runs/%5Bid%5D/actions.ts#L8-L16) — `getClaims()` + `redirect("/login")` винесено в локальний `signedInClient()` | хибної тривоги немає (коментаря немає) | хибної тривоги немає: «Помічник `signedInClient` є лише в одному файлі … Краще винести його в `src/lib/auth`» (порада) |

- Інші знахідки:
  - CodeRabbit «Оновіть AC-тести та матрицю відповідності» — частково слушна: тесту AC-EDITOR-08 на `setTaskRequired` немає (він зловив би ваду 2); вимога оновити `conformance.md` — шум;
  - `/code-review`: `run_task_counts` дублює `run_overview`, не викликається, типи не оновлено — слушна;
  - `/code-review`: «`setTaskRequired` тепер створює два клієнти Supabase на один запит» — слушна (наслідок вади 2);
  - `/code-review`: дубль перевірки входу в `runs/new/actions.ts` — слушна дрібниця.
- Ворота: перша версія вади 3 (видалене твердження) не дійшла б до рецензентів — `npm run gates` (fallow audit): «`weakened-tests (assertion-drop) [error] assertions: 38 -> 37`». Решта вад проходить усі обов'язкові перевірки: `check:actions` перевіряє наявність `requireAdmin`, а не порядок; SQL-функцій без `search_path` не перевіряє ніщо в CI.
- Правило, що закриває пропуск: два рядки в `AGENTS.md` (розділ «База даних»): запис у Server Action до перевірки ролі — «must fix», навіть якщо RLS блокує; `security definer` без будь-якої з чотирьох умов (`private`, `search_path`, перевірка доступу, `revoke execute`) — «must fix». PR https://github.com/yuriivynar/property-workflows/pull/42, коміт https://github.com/yuriivynar/property-workflows/commit/6d7352d
- Повторний прогін: https://github.com/yuriivynar/property-workflows/pull/41#issuecomment-6575184268
  - `/code-review high` — правило подіяло: усі вади явно «must fix» за `AGENTS.md`; вада 1 розкладена на дві з наслідком «`anon` може викликати її без входу»; про приманку — «Зміна `markTaskDone` через `signedInClient` поводиться так само, як раніше»;
  - CodeRabbit — без помітної зміни: «No actionable comments were generated in the recent review» (старі треди відкриті, inline не перегенеровано), pre-merge checks — ті самі Warning, що й до правила; ризик у security review понижено з «High» до «Medium». Слабке місце — Minor на inline до вади 2 — правилом в `AGENTS.md` не закрито.
