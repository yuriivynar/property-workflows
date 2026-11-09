# Дизайн: вендор — виконавець задач

## Context

Ролі `manager` і `admin` уже обмежено RLS і функціями бази (`private.current_app_role()`, `private.can_see_run`,
`launch_run`, `mark_task_done`, `staff_directory`). Зріз 3 додає третю роль, яка бачить і змінює менше за менеджера:
лише свої задачі. Головний ризик — розкрити вендору дані, які матриця прав закриває (шаблони, чужі задачі, email колег,
назву й версію шаблону запуску, прогрес усього запуску), прямим запитом до REST, а не лише на сторінці («Припущення»
PM: кожне обмеження матриці діє й для прямих запитів). Рішення згруповано за розділами «UI і компоненти», «Дані й RLS»
і «Auth»; кожне — з AC ID.

## Decisions

### Дані й RLS

1. **Роль `vendor` — новою міграцією** `…_vendor_role.sql` (AC-VENDOR-01…10). Порядок — як у
   `20261012000000_profiles_and_roles.sql`: зняти `profiles_role_check` → новий з `'vendor'`. Наявні дані й `default`
   (`manager`) не змінюються. Користувачі-вендори — початкові дані `supabase/demo-users.json`
   (`vendor@example.test`, `pm-vendor@example.test`), як і інші (`npm run users:demo`).
2. **RLS — закрити все, що вендору не належить** (AC-VENDOR-04, AC-VENDOR-06, AC-VENDOR-08):
   - `templates`, `template_versions`: `admin` — усе, `manager` — збережене / поточне, `vendor` — нічого
     (розділи й задачі шаблонів уже лише для `admin`);
   - `runs` (і `run_overview`, `security_invoker`): вендору — жодного рядка, бо там назва шаблону, версія, менеджер
     запуску, а `run_overview` — прогрес усього запуску;
   - `run_tasks`: вендору — лише рядки, де він виконавець (`private.can_see_run_task`);
   - `run_sections`: вендору — лише розділи, де є його задача (`private.can_see_run_section`);
   - хелпери — у `private`, `security definer`, `set search_path = ''`, `revoke … from public, anon`, щоб політики
     `run_sections` і `run_tasks` не посилались одна на одну (42P17), як `private.can_see_run`.
3. **Список і сторінка запуску вендора — функціями бази** (AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-10):
   `public.vendor_runs()` (`id` запуску — для посилання на `/runs/[id]`, назва випадку, статус запуску, `my_done` /
   `my_total` — лише його задачі, найновіші вгорі) і `public.vendor_run_tasks(run_id)` (`id` задачі — для
   `MarkDoneButton` і `mark_task_done`, назва, розділ, обов'язковість, статус і `needs_confirmation` — остання
   обов'язкова задача «to do» запуску, та сама умова, що в `mark_task_done`). Логіка — `private`, `security definer`;
   у `public` — обгортки `security invoker`; іншим ролям повертають порожньо.
4. **Довідник колег** (AC-VENDOR-02): `staff_directory` повертає й вендорів, як і раніше лише `id` і `email` і лише
   менеджеру та адміністратору; вендор отримує порожньо (email інших — «—» у матриці).
5. **Запуск** (AC-VENDOR-01, AC-VENDOR-09): `launch_run` приймає виконавцем `manager`, `admin` або `vendor`; перевірка
   ролі того, хто запускає (`manager`, `admin`), — без змін, тож вендор отримує `LAUNCH_NOT_ALLOWED` і запуску немає.
   Менеджер запуску — завжди той, хто запустив, тож вендор ним не стає.
6. **Позначка** (AC-VENDOR-05, AC-VENDOR-07): `mark_task_done` дозволяє виконавцю, адміністратору й менеджеру
   запуску — право менеджера запуску лише за поточної ролі `manager` (рецензія CodeRabbit, CWE-863): якщо колишньому
   менеджеру змінять роль на `vendor` (питання solomchaak/property-workflows-spec#45), він позначатиме лише задачі, де
   він виконавець. Решта логіки (підтвердження останньої обов'язкової, завершення запуску) — без змін, як для всіх
   («Припущення» PM; питання solomchaak/property-workflows-spec#43 відкрите).
7. **Права на колонки й функції** (AC-VENDOR-07, AC-VENDOR-09): прямий запис вендора в `runs` і `run_tasks` закрито
   відсутністю `grant insert/update` (відмова `42501`), а не лише політикою; нові функції — `revoke execute … from
   public, anon`, `grant execute … to authenticated`.

### Auth

8. **Роль — з `profiles.role`, ніколи з `user_metadata`** (AC-VENDOR-07, AC-VENDOR-08, AC-VENDOR-09): `AppRole` += `vendor`;
   `currentUser()` читає роль з `profiles` за `claims.sub` після `getClaims()`; `requireAdmin()` — як раніше лише `admin`.
9. **Server Action перевіряє вхід і роль до першого запису** (AC-VENDOR-09, AC-VENDOR-07): `launchRun` викликає
   `currentUser()` і для вендора повертає `LAUNCH_NOT_ALLOWED` до `rpc("launch_run")`; `markTaskDone` читає роль до
   `rpc("mark_task_done")`, а хто саме може позначити задачу — вирішує функція бази. База лишається другою лінією захисту
   (правило проєкту, `scripts/check-actions-claims.mjs`).
10. **Сторінки шаблонів і запуску** (AC-VENDOR-08, AC-VENDOR-09): `templatePageAccess(vendor, …)` — «Not enough rights»
    на кожній сторінці шаблонів, зокрема на списку; `/runs/new` — так само (матриця: «Launch a template» — «—»).
    Після входу вендор потрапляє на `/runs` (робоче рішення до solomchaak/property-workflows-spec#44).

### UI і компоненти

11. **`/runs` для вендора — `VendorRuns`** (AC-VENDOR-03, AC-VENDOR-10): колонки «Case», «Status», «Your tasks: N of K
    done»; порожньо — `EmptyState` «No tasks assigned to you yet.» без посилання й без порожньої таблиці; без назви
    шаблону — робоче рішення до solomchaak/property-workflows-spec#42.
12. **`/runs/[id]` для вендора — `VendorRun`** (AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06): заголовок — назва випадку,
    рядок «Your tasks: N of K done», задачі за розділами з `StatusBadge` і `MarkDoneButton`; без менеджера запуску,
    шаблону, версії, email і прогресу всього запуску; без його задач — «Run not found»; збій бази — повідомлення про
    помилку, а не «Run not found»; заголовок і рядок — робоче рішення до solomchaak/property-workflows-spec#41.
13. **Вибір виконавця в «Launch a template»** (AC-VENDOR-01, AC-VENDOR-02): нативний `NativeSelect` на задачу, пункти —
    «Me (run manager)» і email колег з `staff_directory` (без імен і ролей).
14. **Навігація** (AC-VENDOR-08): без «Templates» для вендора (`MainNav`); спільні компоненти дизайн-системи
    (`StatusBadge`, `EmptyState`, `Notice`, `TextLink`), нових токенів немає.

## Risks / Trade-offs

- Відповіді PM на Q13–Q16 (#41–#44) можуть змінити заголовок сторінки запуску вендора, колонку шаблону, підтвердження
  й навігацію — це правки сторінок і `vendor_run_tasks`, без зміни моделі даних.
- `runs` для вендора закрито повністю: сторінки вендора читають лише функції, а не таблиці; спільний код сторінок
  менеджера для вендора не підходить, тому для вендора — окремі компоненти.
- Тести обв'язки PGlite зі `stopBefore` ставлять роль `vendor` лише після `migrateRest()` — до міграції ролі ще немає.
- Доказ відмов — тест бази на PGlite без моків і SQL-мутанти (`scripts/mutants.mjs`, V02–V09); тести дій із моками доказом
  відмови не є.
