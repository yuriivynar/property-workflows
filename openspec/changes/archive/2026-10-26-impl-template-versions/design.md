# Design: impl-template-versions

## Context

Зріз 2 (`openspec/specs/template-versions`, `openspec/specs/design-system`). Зараз шаблон — це `templates` +
`template_sections` + `template_tasks` (довідкові дані з міграцій, усі читають, ніхто не пише), а `launch_run` копіює
розділи й задачі шаблону в `run_sections` / `run_tasks` (AC-RUN-02, AC-RUN-12). Ролі `manager` і `admin` — у
`profiles.role`, хелпер `private.current_app_role()`. Тести бази — PGlite (`tests/db/supabase-pglite.ts`, ADR 0001).
Дизайн-система (токени, `@/components/ui`, `StatusBadge`, `TextLink`) уже на `main` (PR #13, `DESIGN.md`).

Відповідей PM на питання зрізу 2 ще немає (solomchaak/property-workflows-spec#21–#34); де вони впливають на
реалізацію — робоче рішення в розділі «Робочі рішення до відповідей PM», без нових правил у специфікації.

## Goals / Non-Goals

- **Goals:** версії шаблону з незбереженими змінами; редактор лише для адміністратора; менеджер бачить лише поточну
  версію; запуск — з поточної версії й показує її номер; відмови й порожні стани в одному макеті; кожен відмовний AC —
  тест бази чи дії, що падає без політики.
- **Non-Goals:** видалення шаблону, перегляд і відновлення старих версій, порівняння, одночасне редагування, імпорт
  (Non-goals специфікації); перемикач теми (пропозиція solomchaak/property-workflows-spec#34); admin-клієнт і
  `SUPABASE_SECRET_KEY` у Vercel — не потрібні.

## Decisions

## Дані й RLS

### 1. Незбережені зміни = робоча копія в наявних таблицях (AC-EDITOR-01, AC-EDITOR-02)

`template_sections` і `template_tasks` стають **незбереженими змінами** шаблону: один набір на шаблон, спільний для всіх
адміністраторів (Assumptions специфікації). Після збереження робоча копія дорівнює поточній версії й лишається
основою для наступних змін. Нових таблиць для чернетки не вводимо: редактор пише туди ж, де лежали довідкові дані.

`templates` отримує колонки:

- `current_version integer null` — номер поточної версії; `null` — шаблон ще не зберігали (менеджер його не бачить);
- `has_unpublished_changes boolean not null default true` — позначка «Unpublished changes»; новий шаблон з'являється
  з нею (Assumptions), наявні шаблони міграція переводить у `false`.

Обидві колонки змінюють **лише** тригер і функція збереження: `grant update` на них не видаємо нікому з
`authenticated` (пастка «update own row + колонка-статус», як із `profiles.role`).

### 2. Версія — незмінний знімок (AC-EDITOR-03, AC-EDITOR-05, AC-EDITOR-06) — кандидат в ADR

Нова таблиця `template_versions`:

| Колонка | Тип | Навіщо |
|---|---|---|
| `id` | `uuid` pk | |
| `template_id` | `uuid` → `templates` | |
| `number` | `integer`, `unique (template_id, number)` | 1, 2, 3… без повторів (Assumptions) |
| `content` | `jsonb` | знімок: розділи (назва, позиція) і задачі (id задачі робочої копії, назва, `is_required`, позиція) |
| `created_by` | `uuid` → `profiles` | автор для списку версій (AC-EDITOR-05) |
| `created_at` | `timestamptz default now()` | дата й час для списку версій (AC-EDITOR-05) |

Знімок у `jsonb`, а не дзеркальні таблиці `version_sections` / `version_tasks`: версію ніколи не змінюють і не
запитують по частинах — її лише показують і копіюють у запуск. Альтернатива (нормалізовані таблиці) — у ADR.

Незмінність: `authenticated` має лише `select` на `template_versions`; `insert` робить тільки функція збереження,
`update` / `delete` не видано нікому, крім `service_role`.

`runs` отримує `template_version integer` — номер версії, з якої запущено (копія, як `template_name`): менеджер не
читає старих версій, але має бачити «Template version N» свого запуску (AC-EDITOR-06).

### 3. Політики — окремо на кожну операцію, `to authenticated`, `(select auth.uid())` через хелпер ролі

| Таблиця | select | insert | update | delete |
|---|---|---|---|---|
| `templates` | `admin` — усі; `manager` — лише `current_version is not null` (AC-EDITOR-02) | `admin` (створення з назвою; `grant insert (name)`) | — (перейменування поза зрізом, solomchaak/property-workflows-spec#29) | — (поза зрізом) |
| `template_sections` | лише `admin` (AC-EDITOR-02: менеджер не бачить незбережених змін) | `admin` | `admin`, `grant update (name, position)` | `admin` |
| `template_tasks` | лише `admin` | `admin` | `admin`, `grant update (name, is_required, position, section_id)` | `admin` |
| `template_versions` | `admin` — усі; `manager` — лише рядок, де `number = templates.current_version` (AC-EDITOR-02, AC-EDITOR-07) | — (лише функція) | — | — |
| `runs`, `run_*` | без змін (`private.can_see_run`) | — | — | — |

Кожна умова «`admin`» — `(select private.current_app_role()) = 'admin'` (роль з `profiles`, ніколи з
`user_metadata`). `anon` не має жодних прав на ці таблиці (`revoke all … from anon`; AC-EDITOR-09, AC-DSYS-03).

Тригер `after insert or update or delete` на `template_sections` / `template_tasks` викликає
`private.mark_unpublished(template_id)` (`security definer`, `set search_path = ''`), що ставить
`has_unpublished_changes = true` (AC-EDITOR-01).

### 4. Функції бази (одна транзакція на привілейовану дію) — кандидат в ADR

- `private.save_template_version(p_template_id)` (`security definer`, `set search_path = ''`) + тонка обгортка
  `public.save_template_version` (`security invoker`, `grant execute` лише `authenticated`):
  1. першим рядком — роль: не `admin` → `NOT_ALLOWED` (42501), нічого не змінено (AC-EDITOR-08);
  2. блокування рядка шаблону (`for update`);
  3. немає жодної обов'язкової задачі в робочій копії → `TEMPLATE_NEEDS_REQUIRED_TASK`, версії немає, робоча копія й
     позначка без змін (AC-EDITOR-04);
  4. немає незбережених змін → `NO_UNPUBLISHED_CHANGES` (робоче рішення до solomchaak/property-workflows-spec#22);
  5. `number = coalesce(current_version, 0) + 1`, знімок робочої копії в `template_versions`, `created_by = auth.uid()`;
     `templates.current_version = number`, `has_unpublished_changes = false` (AC-EDITOR-03).
- `private.launch_run` (нова версія функції): бере розділи й задачі **з поточної версії** (`content` знімка), а не з
  робочої копії; записує `runs.template_version`; шаблон без поточної версії → `TEMPLATE_NOT_FOUND` (робоче рішення
  до solomchaak/property-workflows-spec#21). Ключі призначень — id задач зі знімка. Поведінка AC-RUN-01…12 та сама.
- `private.move_template_item(p_kind, p_id, p_direction)` (`security definer`, `set search_path = ''`) + тонка обгортка
  `public.move_template_item` (`security invoker`) — перестановка розділу чи задачі на одну позицію в одній
  транзакції (унікальність `(template_id, position)` не дає поміняти місцями двома окремими `update`). `security
  definer` обходить RLS, тому функція **першим рядком** перевіряє роль: не `admin` → `NOT_ALLOWED` (42501) до
  будь-якого запису (AC-EDITOR-08) — `requireAdmin()` у server action цього не замінює, бо RPC можна викликати
  напряму з публічним ключем.
- Для всіх функцій зрізу (`save_template_version`, `launch_run`, `move_template_item`, `mark_unpublished`): `revoke
  execute … from public, anon`, `grant execute … to authenticated` — і для `private.*`, і для обгорток; тригерна
  `private.mark_unpublished` не має обгортки в `public`.

### 5. Міграція даних (одна міграція `…_template_versions.sql`)

Наявні шаблони стають версією 1: знімок поточних таблиць, `created_by` — перший адміністратор, `created_at` — час
міграції; `current_version = 1`, `has_unpublished_changes = false`. Наявні запуски — `template_version = 1` (робоче
рішення до solomchaak/property-workflows-spec#33). Набір ролей не змінюється — міграція drop-first не потрібна.

## UI і компоненти

Лише `@/components/ui` і токени `DESIGN.md`; тексти — дослівно з AC.

| Сторінка | Хто | Що | AC |
|---|---|---|---|
| спільний макет `PageShell` (`src/components/ui/page-shell.tsx`): назва продукту, навігація Templates · Runs · Profile, `main` однакової ширини | усі сторінки, зокрема `/login` (без навігації) | «той самий макет сторінки» | AC-DSYS-02, AC-DSYS-03 |
| `/templates` | `admin`: усі шаблони, `StatusBadge` «Unpublished changes», форма «Create a template»; `manager`: лише збережені | `Table`, `StatusBadge`, `EmptyState` | AC-EDITOR-01, AC-EDITOR-02 |
| `/templates/[id]` | обидві ролі: поточна версія лише для читання — «Version N», розділи, задачі з «required»/«optional», посилання «Launch»; `admin` — ще «Edit» і «Versions» | `Card`, `TextLink` | AC-EDITOR-02 (робоче рішення до solomchaak/property-workflows-spec#25) |
| `/templates/[id]/edit` | `admin`: розділи й задачі (додати, перейменувати, змінити порядок, видалити, «required»), «Save» (`Button` default — єдина головна дія), «Unpublished changes», помилка `Alert` | `Input`, `Label`, `Button`, `Alert`, `StatusBadge` | AC-EDITOR-01, AC-EDITOR-03, AC-EDITOR-04 |
| `/templates/[id]/edit` | `manager` | `Notice`: «Not enough rights» + `TextLink` «Back to templates», без даних редактора | AC-DSYS-02 |
| `/templates/[id]/versions` | `admin`: `Table` — номер, «DD.MM.YYYY HH:MM» (Київ), email автора, найновіша перша | `Table` | AC-EDITOR-05 |
| `/templates/[id]/versions` | `manager` | `Notice`: «Not enough rights», без версій | AC-EDITOR-07 |
| `/runs/[id]` | хто бачить запуск | «Template version N» біля назви шаблону | AC-EDITOR-06 |
| `/runs` | менеджер без запусків | `EmptyState`: «No runs yet. Launch a template to start one.» + `TextLink` «Launch a template», без таблиці | AC-DSYS-04 |
| `/runs`, `/runs/[id]` | усі | статус — лише `StatusBadge` (одна мапа слово + колір) | AC-DSYS-01 |

Нові компоненти в `src/components/ui`: `PageShell`, `Notice` (повідомлення + посилання назад), `EmptyState`. Доменні
функції (чистий TypeScript, `src/lib/templates/`): `formatVersionDate` (Київ, `DD.MM.YYYY HH:MM`, AC-EDITOR-05),
`messageForTemplateError` (коди функцій → тексти AC), `templatePageAccess(role, page)` → `"ok" | "not-enough-rights"`
(AC-DSYS-02, AC-EDITOR-07); у `src/lib/runs/`: `runsListState(runs)` → `"empty" | "table"` (AC-DSYS-04).

Автозбереження: кожна зміна в редакторі — окрема server action, яка одразу пише в робочу копію; окремої кнопки
«зберегти чернетку» немає (AC-EDITOR-01). Успіх збереження — «Version N saved» на сторінці (DESIGN.md, «Стани»).

## Auth

- **Вхід:** `src/proxy.ts` лише оновлює сесію й перенаправляє на `/login` (UX). Захист — не тут: кожна сторінка зрізу
  сама викликає `getClaims()` і без claims робить `redirect("/login")` до будь-якого запиту даних (AC-EDITOR-09,
  AC-DSYS-03); `anon` не має прав на таблиці.
- **Кожна server action зрізу** (`createTemplate`, `addSection`, `renameSection`, `removeSection`, `addTask`,
  `renameTask`, `setTaskRequired`, `removeTask`, `moveItem`, `saveVersion`): першим кроком — спільна функція
  `requireAdmin()` (`src/lib/auth/require-role.ts`): `getClaims()` → немає claims — помилка без запису; роль — з
  `public.profiles` за `claims.sub`, не `admin` — помилка «Not enough rights» без запису. Лише потім запис **клієнтом
  користувача** (діють RLS і GRANT — друга лінія, AC-EDITOR-08). Вхідні id не довіряємо: їх перевіряє RLS.
- **Сторінки** `/templates/[id]/edit` і `/templates/[id]/versions`: роль з `profiles` → `templatePageAccess`; для
  `manager` дані не запитуються взагалі, показано `Notice` (AC-DSYS-02, AC-EDITOR-07).
- **Admin-клієнт** (`SUPABASE_SECRET_KEY`) не потрібен: усі дії — від імені користувача під RLS; Admin API у зрізі
  немає. `getSession()` не використовуємо.
- Архітектурне правило (рубрика D): `scripts/check-actions-claims.mjs` у `architecture.yml` — кожен `actions.ts` у
  `src/app/` викликає `getClaims()` або `requireAdmin()` / `requireUser()` (крім дій входу), і жодного `getSession(`
  у `src/` — кандидат в ADR разом із рішенням «перевірка в дії + RLS».

## Тести

- **База (PGlite, `tests/db/template-versions.test.ts`):** AC-EDITOR-01 (зміна адміністратора лишається в робочій
  копії, позначка `true`), AC-EDITOR-02 (менеджер: 0 рядків робочої копії, лише поточна версія), AC-EDITOR-03 (версія 2
  з 6 задачами, позначка `false`), AC-EDITOR-04 (виняток, версії немає, 1 розділ і 3 задачі лишились, позначка
  `true`), AC-EDITOR-05 (порядок і автор), AC-EDITOR-06 (запуск з версії 1 після версії 2 — 5 задач, номер 1),
  AC-EDITOR-07 (менеджер не читає версій, крім поточної), AC-EDITOR-08 (менеджер: `insert` / `update` / `delete`
  робочої копії, `save_template_version` і `move_template_item` — `NOT_ALLOWED`, шаблон і позиції без змін), AC-EDITOR-09 і AC-DSYS-03 (`asAnon`: жодного
  рядка шаблону й запуску). Кожен відмовний тест перевіряє і відмову, і незмінні дані (`asService`).
- **Домен і дії:** `formatVersionDate` (AC-EDITOR-05), `templatePageAccess` (AC-DSYS-02, AC-EDITOR-07),
  `runsListState` (AC-DSYS-04), мапа `StatusBadge` (AC-DSYS-01), `requireAdmin` у діях — менеджер отримує помилку до
  запису (AC-EDITOR-08).
- **Регрес зрізу 1:** тести AC-RUN-* і AC-TASK-* лишаються зеленими після переходу `launch_run` на версії.
- **Мутаційна перевірка:** для кожного відмовного AC — таблиця «AC → що прибрали → який тест упав» в описі PR;
  щонайменше два червоні прогони CI (комміти `mutation: …` + revert), наприклад: політика `select` робочої копії →
  `using (true)` (AC-EDITOR-02) і перевірка ролі в `save_template_version` (AC-EDITOR-08).

## Робочі рішення до відповідей PM

| Питання | Робоче рішення | Що зміниться, якщо PM вирішить інакше |
|---|---|---|
| solomchaak/property-workflows-spec#21 (запуск незбереженого шаблону) | немає в формі запуску; прямий запуск → `TEMPLATE_NOT_FOUND` | нове повідомлення / AC — зміна `clarify-…` |
| solomchaak/property-workflows-spec#22 («Save» без змін) | кнопка неактивна без позначки; функція → `NO_UNPUBLISHED_CHANGES` | текст повідомлення |
| solomchaak/property-workflows-spec#23 (підтвердження видалення) | видалення без підтвердження (зміни не версія, лише робоча копія) | `Dialog` «This cannot be undone» |
| solomchaak/property-workflows-spec#24 (розділ без задач) | дозволено, у запуску розділ без задач | перевірка в `save_template_version` |
| solomchaak/property-workflows-spec#25 (де менеджер бачить шаблон) | `/templates/[id]` лише для читання | інша сторінка |
| solomchaak/property-workflows-spec#26 (незбережений шаблон за посиланням) | «Template not found» (RLS не повертає рядка) | текст `Notice` |
| solomchaak/property-workflows-spec#27 (порожні списки шаблонів і версій) | `EmptyState` «No templates yet.» / «No versions yet.» | тексти |
| solomchaak/property-workflows-spec#28 (порожні назви) | поле обов'язкове у формі й `check (char_length(trim(name)) > 0)` у базі | повідомлення |
| solomchaak/property-workflows-spec#29 (перейменування шаблону) | немає | `grant update (name)` + знімок назви |
| solomchaak/property-workflows-spec#30 (однакові назви) | наявне `unique (name)`: «A template with this name already exists» | прибрати обмеження |
| solomchaak/property-workflows-spec#31 (збій автозбереження) | `Alert` «Your last change was not kept. Try again.» біля редактора | текст і місце |
| solomchaak/property-workflows-spec#33 (запуски до версій) | `template_version = 1` | номер / «—» |
| solomchaak/property-workflows-spec#34 (вибір теми) | тема за пристроєм | нова задача |

## Risks / Trade-offs

- **Робоча копія в наявних таблицях** — менше міграцій і коду, але менеджер втрачає прямий доступ до
  `template_sections` / `template_tasks`: форма запуску й `launch_run` мусять перейти на знімок версії в тому самому PR,
  інакше менеджер не побачить задач у формі запуску.
- **`jsonb`-знімок** — версію не перевірити зовнішніми ключами; формат знімка фіксує одна функція (`save_template_version`)
  і тест на AC-EDITOR-03 / AC-EDITOR-06.
- **Одночасне редагування** поза зрізом: два адміністратори пишуть в одну робочу копію, останній запис перемагає.
