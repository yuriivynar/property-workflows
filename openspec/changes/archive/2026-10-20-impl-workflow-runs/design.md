# Design: impl-workflow-runs

## Context

Специфікація зрізу — `openspec/specs/run-launch/spec.md` (AC-RUN-01…09) і `openspec/specs/run-progress/spec.md`
(AC-TASK-01…09). Стек фіксований шаблоном: Next.js 16 App Router (`src/`, server actions, `src/proxy.ts`), Supabase
(Postgres + Auth + RLS), Vercel, Vitest. Схема бази — лише міграціями через PR; у хмару їх застосовує job `db-deploy`.
Ролі зберігаються в `public.profiles.role` (міграція шаблону `20261012000000_profiles_and_roles.sql`), а не в JWT.

PM ще не відповів на питання solomchaak/property-workflows-spec#4–#15. Там, де відповідь змінює реалізацію,
беремо робоче рішення з `docs/spec-reading.md` і тримаємо його в одному місці (розділ «Робочі рішення» нижче).

## Goals / Non-Goals

**Goals**

- Усі 18 AC специфікації — у коді й тестах з AC ID у назві; рядки `docs/conformance.md` — `реалізовано`.
- Правила доступу виконує база (RLS + функції), а не лише сторінка: прямий запит із публічним ключем їх не обходить.
- Зріз працює на прод-URL під синтетичними користувачами (`*@example.test`).

**Non-Goals**

- Екран редагування шаблонів і екран керування користувачами: шаблони й ролі — початкові дані (Non-goals
  специфікації; solomchaak/property-workflows-spec#14).
- Усе, що в Non-goals специфікації: умовна логіка, зміна виконавця після запуску, скасування позначки, видалення
  запуску, дедлайни, сповіщення.

## Decisions

### 1. Ролі `manager` і `admin` (окрема міграція)

Нова міграція замінює ролі шаблону в порядку з README шаблону: зняти `profiles_role_check` → `member` → `manager` →
default `manager` → новий `check (role in ('manager', 'admin'))`. У тому самому PR — `supabase/demo-users.json`:
`admin@example.test` (`admin`), `manager.a@example.test`, `manager.b@example.test`, `manager.c@example.test`
(`manager`) — менеджери A, B, C зі сценаріїв. Після merge і зеленого `db-deploy` — `npm run users:demo`.
Посилання: AC-RUN-05, AC-RUN-06, AC-RUN-09, AC-TASK-03, AC-TASK-07.

### 2. Модель даних (міграція `…_workflow_runs.sql`)

| Таблиця | Колонки | Для чого |
|---|---|---|
| `templates` | `id`, `name` (unique) | шаблон (AC-RUN-01) |
| `template_sections` | `id`, `template_id`, `name`, `position` (unique в межах шаблону) | розділи шаблону (AC-RUN-01) |
| `template_tasks` | `id`, `template_id`, `section_id`, `name`, `is_required`, `position` | задачі шаблону з позначкою обов'язковості (AC-RUN-01, AC-TASK-04) |
| `runs` | `id`, `template_id` (`on delete set null`), `template_name`, `case_name`, `run_manager_id`, `status` (`in_progress`/`completed`), `created_at` | запуск; назва шаблону й назва випадку зберігаються в запуску (AC-RUN-01, AC-RUN-02, AC-RUN-05, AC-RUN-06, AC-TASK-04) |
| `run_sections` | `id`, `run_id`, `name`, `position` | копія розділів на момент запуску (AC-RUN-02; solomchaak/property-workflows-spec#7) |
| `run_tasks` | `id`, `run_id`, `section_id`, `name`, `is_required`, `position`, `assignee_id`, `status` (`to_do`/`done`) | копія задач на момент запуску з виконавцем і статусом (AC-RUN-01, AC-RUN-02, AC-RUN-04, AC-RUN-08, AC-RUN-09, AC-TASK-01…08) |

- Запуск — **копія**: `run_sections` і `run_tasks` копіюють назви, позиції й `is_required` під час запуску, тож пізніші
  зміни `template_*` запуск не змінюють (AC-RUN-02).
- Коди статусів у базі (`in_progress`, `completed`, `to_do`, `done`) — назви для поведінки PM; на екрані — тексти PM
  дослівно («in progress», «completed», «to do», «done»).
- `case_name`: `check (char_length(case_name) between 1 and 100 and case_name = btrim(case_name))` — остання межа на
  випадок прямого запису (AC-RUN-03, AC-RUN-07).
- `created_at` — лише для порядку списку (найновіші вгорі); на екрані дат немає.

### 3. Права: RLS + GRANT, запис лише через функції

- Кожна таблиця: `enable row level security`, `revoke all … from anon, authenticated`, явний
  `grant select … to authenticated`, `grant all … to service_role`. **Insert / update / delete для `authenticated`
  не видаємо**: усі зміни йдуть через функції нижче, тож прямий запит Data API нічого не змінить.
- `template_*`: політика select `to authenticated` для всіх (матриця: менеджер і адміністратор бачать шаблони).
- `runs`, `run_sections`, `run_tasks`: політика select `to authenticated` через `private.can_see_run(run_id)`
  (`security definer`, `set search_path = ''`): адміністратор, менеджер запуску або виконавець хоча б однієї задачі
  (AC-TASK-06; «Видимість запусків»). Хелпер у `private` не дає політикам `runs` і `run_tasks` зациклитись (42P17).
- `auth.uid()` у політиках — лише як `(select auth.uid())`.

### 4. Функції бази (одна транзакція на дію)

У supabase-js немає транзакцій, тож запуск (запуск + розділи + задачі) і позначка (задача + статус запуску) — кожна
однією функцією Postgres. Логіка й перевірки — у `private.*` (`security definer`, `set search_path = ''`, схема поза
Data API); у `public` — тонка обгортка `security invoker`, яку викликає `supabase.rpc(…)`.

- `launch_run(template_id, case_name, assignments jsonb) → uuid`:
  роль виклику `manager`/`admin`; `case_name` обрізається від пробілів на краях, порожня → помилка `CASE_NAME_REQUIRED`
  (AC-RUN-03), довша за 100 → `CASE_NAME_TOO_LONG` (AC-RUN-07); менеджер запуску — `auth.uid()` (AC-RUN-05,
  AC-RUN-06); `assignments` — `{ template_task_id: assignee_id }`, виконавець — лише профіль `manager`/`admin`, інакше
  `INVALID_ASSIGNEE`; задача без призначення → менеджер запуску (AC-RUN-04, AC-RUN-08, AC-RUN-09); ключі задач, яких
  уже немає в шаблоні, ігноруються (solomchaak/property-workflows-spec#9). Створює рівно один запуск `in_progress` з
  усіма задачами `to_do` (AC-RUN-01).
- `mark_task_done(task_id) → void`:
  дозволено виконавцю задачі, менеджеру запуску й адміністратору (AC-TASK-01, AC-TASK-02, AC-TASK-07); інакше — та
  сама помилка `NOT_ALLOWED` і для чужої, і для відсутньої задачі (AC-TASK-03; solomchaak/property-workflows-spec#4);
  після перевірки доступу функція блокує рядок запуску (`select … from runs … for update`), тож дві одночасні позначки
  задач одного запуску виконуються по черзі і друга бачить зміну першої; задача вже `done` — нічого не змінюється
  («Припущення» PM); коли не лишилось обов'язкових задач `to_do` — запуск `completed` (AC-TASK-04).
- `staff_directory() → (id, full_name, email)` для `manager`/`admin`: ім'я та email менеджерів і адміністраторів — для
  вибору виконавця й підпису біля задач; роль і інші дані профілю не повертаються
  (solomchaak/property-workflows-spec#5, AC-RUN-04, AC-TASK-08).
- Подання `run_overview` (`security_invoker = true`, тож діє RLS): запуск + `done_count` і `total_count` — для прогресу
  «N of M done» у списку й на сторінці (AC-TASK-05, AC-TASK-09).

### 5. Доменний модуль `src/lib/runs/` (чистий TypeScript, без Supabase)

- `messages.ts` — усі тексти екранів і повідомлень в одному місці, дослівно з AC: «Enter a case name», «Case name must
  be at most 100 characters», «Only the task's assignee, the run manager, or an administrator can mark a task as done»,
  статуси (solomchaak/property-workflows-spec#13).
- `domain.ts` — `validateCaseName` (обрізання пробілів на краях, 1–100 символів; AC-RUN-03, AC-RUN-07),
  `formatProgress` («N of M done»; AC-TASK-05, AC-TASK-09), `statusLabel`, `canMarkTask` (лише щоб показати кнопку;
  остаточно вирішує база), `messageForError` (код помилки функції → текст).

### 6. Сторінки й server actions

| Шлях | Що | AC |
|---|---|---|
| `/` | профіль і посилання на запуски | — |
| `/runs` | список видимих запусків: назва випадку, назва шаблону, статус, прогрес; найновіші вгорі | AC-TASK-06, AC-TASK-09 |
| `/runs/new` | вибір шаблону → назва випадку і виконавець для кожної задачі (за замовчуванням — я), задачі за розділами; `launchRun` → `rpc('launch_run')` → `/runs/<id>` або повідомлення | AC-RUN-01, AC-RUN-03…09 |
| `/runs/[id]` | запуск: назва випадку, шаблон, статус, прогрес; задачі за розділами з виконавцем, «required»/«optional» і статусом; кнопка позначки з підтвердженням лише там, де дозволено; `markTaskDone` → `rpc('mark_task_done')`; запуск, якого користувач не бачить, — «Run not found» | AC-RUN-02, AC-TASK-01…05, AC-TASK-07, AC-TASK-08 |

Server actions беруть користувача з `getClaims()`, кнопка запуску неактивна, поки форма відправляється (від
подвійного кліку; solomchaak/property-workflows-spec#8).

### 7. Тести

- **База (PGlite):** справжній Postgres у WASM з усіма `supabase/migrations/*.sql` і `supabase/seed.sql`, ролі Supabase
  емульовано, запити — від імені користувача (`authenticated`, `auth.uid()`). Інфраструктура
  `tests/db/supabase-pglite.ts` взята з демо-репозиторію курсу з посиланням на джерело в PR і файлі; ADR — у
  `docs/decisions/`. Тут — правила, які виконує лише база: AC-RUN-01, AC-RUN-02, AC-RUN-04…09, AC-TASK-01…09
  (`tests/db/run-launch.test.ts`, `tests/db/run-progress.test.ts`).
- **Домен:** `src/lib/runs/domain.test.ts` — тексти й межі назви випадку (AC-RUN-03, AC-RUN-07), формат прогресу.
- **AC-TASK-03:** сторонній менеджер не бачить чужого запуску («Run not found»), а співвиконавець не бачить кнопки на
  чужій задачі, тож повідомлення з'являється лише тоді, коли дію надіслано попри інтерфейс (стара сторінка, прямий
  запит). Тому тест перевіряє саму дію: прямий виклик `mark_task_done` повертає `NOT_ALLOWED`, задача лишається
  `to_do`, а `messageForError('NOT_ALLOWED')` дає текст AC-TASK-03 дослівно.
- **Одночасні позначки:** PGlite має одне з'єднання, тож справжню гонку двох транзакцій тут не відтворити; блокування
  рядка запуску перевіряємо читанням коду функції, а тест AC-TASK-04 — послідовними позначками.
- Назва кожного тесту починається з AC ID; рядок матриці вказує на файл із цим тестом.

### 8. Довідкові дані

Окрема міграція з `insert … on conflict do nothing` (сид у хмарі вже виконано, повторно не виконується): шаблон
«Tenant move-in» — 2 розділи, 5 задач, 3 обов'язкові (як у AC-RUN-01) — і шаблон «Repair request» для різноманіття.

### 9. Робочі рішення до відповідей PM

| Питання | Рішення зараз | Що зміниться після іншої відповіді |
|---|---|---|
| solomchaak/property-workflows-spec#13 мова | англійські тексти дослівно, `src/lib/runs/messages.ts` | лише `messages.ts` і очікувані тексти в тестах |
| solomchaak/property-workflows-spec#14 користувачі | без екрана, ролі — `demo-users.json` | нова задача з екраном адміністратора |
| solomchaak/property-workflows-spec#15 підтвердження | підтвердження перед позначкою | лише компонент кнопки |
| коментар у solomchaak/property-workflows-spec#10 | шаблон у рядку, найновіші вгорі | сторінка `/runs` |
| solomchaak/property-workflows-spec#4 сторонній | «Run not found», кнопок немає, база відповідає `NOT_ALLOWED` | сторінка `/runs/[id]` |
| solomchaak/property-workflows-spec#5 дані колег | ім'я та email через `staff_directory` | поля, які повертає `staff_directory` |
| solomchaak/property-workflows-spec#6 пробіли | обрізання на краях, зберігаємо обрізане | `validateCaseName` і `launch_run` |
| solomchaak/property-workflows-spec#7 розділи | копіюємо, групуємо, порядок не тестуємо | `run_sections` і сторінка запуску |
| solomchaak/property-workflows-spec#8 повтори | дозволено; захист лише від подвійного кліку | перевірка в `launch_run` |
| solomchaak/property-workflows-spec#9 зміна шаблону | шаблон на момент натискання «Launch» | перевірка версії в `launch_run` |
| solomchaak/property-workflows-spec#11 обов'язкові | «required»/«optional» біля задачі | сторінка запуску |
| solomchaak/property-workflows-spec#12 список адміністратора | усі запуски в одному списку | сторінка `/runs` |

## Risks / Trade-offs

- **Одна база для проду й усіх preview.** Міграції лише додають таблиці й функції; деструктивного немає, окрім заміни
  ролей (`member` → `manager`), яку робимо в порядку з README шаблону.
- **Типи бази.** Генератор типів працює лише в CI (Summary job `db-check`), тож `database.types.ts` для нових таблиць і
  функцій пишемо в тому самому форматі й звіряємо з Summary.
- **PGlite — емуляція.** Auth, PostgREST і JWT спрощені; правила бази перевіряються справжнім Postgres, а вхід і
  налаштування хмари — вручну на preview й проді.
