# Дизайн: уточнення зрізу 3 (вендори) після відповідей PM 10.11

## Context

Зріз 3 реалізовано планом `impl-vendor-assignees` (архів 2026-11-02): роль `vendor`, RLS `runs`/`run_sections`/
`run_tasks`/`templates`/`template_versions`, функції `vendor_runs()`, `vendor_run_tasks()`, `mark_task_done`,
сторінки `VendorRuns` і `VendorRun`. Відповіді PM 10.11 (solomchaak/property-workflows-spec#41–#50) здебільшого
закріплюють робочі рішення, які вже є в коді, тож план — переважно **докази**: тести бази без моків, юніт-тести,
e2e і мутанти для кожної відмови. Код змінюється у двох місцях, де він розходиться з рішенням PM (рішення 4 і 5).
Нових таблиць, колонок і міграцій немає; ADR не потрібен. Рішення — за розділами «Дані й RLS», «Auth», «UI і компоненти».

## Decisions

### Дані й RLS

1. **Прямі читання вендора — уже закриті RLS і функціями; доводимо тестами бази** (AC-VENDOR-17, AC-VENDOR-18).
   `run_tasks` — лише рядки, де він виконавець (`private.can_see_run_task`); `runs`/`run_overview` — жодного рядка;
   `profiles` — лише власний; `staff_directory()` вендору — порожньо; `vendor_run_tasks(чужий запуск)` — порожньо.
   Тести в `tests/db/vendor-work.test.ts` (PGlite, без моків) від імені вендора `select` з `run_tasks`, `run_sections`,
   `runs`, `run_overview`, `profiles` і виклики `staff_directory()`, `vendor_run_tasks()` для обох запусків. Мутанти:
   наявні V04 (`can_see_run_task`) і V06 (`vendor_run_tasks` без перевірки виконавця) — ще й для AC-VENDOR-17 (окремий
   мутант дублював би їх); нові V18 (`staff_directory` віддає email і вендору) і V18P (політика `profiles` — вендору всі
   профілі).
2. **Необов'язкова задача завершеного запуску** (AC-TASK-19, AC-VENDOR-16). `mark_task_done` уже не перевіряє статус
   запуску: позначає задачу, рахує її в прогресі й не змінює `completed`. Доводимо тестами бази для менеджера-виконавця
   й вендора; мутант T19 — `mark_task_done` відмовляє (`RUN_COMPLETED`), якщо запуск `completed`.
3. **Чужа задача прямим запитом** (AC-VENDOR-07, AC-VENDOR-15). База відповідає `NOT_ALLOWED` в обох випадках (і
   «чужа задача у своєму запуску», і «задача запуску без своїх задач»): так база не підказує, чи існує запуск. Різні
   повідомлення робить сторінка (рішення 5). Наявний мутант V07 доводить незмінний статус.

### Auth

4. **Відмова на всіх сторінках шаблонів для вендора — посилання «Back to runs»** (AC-VENDOR-08, AC-VENDOR-14).
   Зараз `/templates/[id]/edit` і `/templates/[id]/versions` ведуть «Back to templates» і вендора: він потрапив би на
   ще одну відмову. Нова чиста функція `refusalBackLink(role)` у `src/lib/templates/domain.ts`: `vendor` →
   `/runs` + «Back to runs», інші → `/templates` + «Back to templates» (менеджеру лишається AC-EDITOR-07). Нею
   користуються всі п'ять сторінок відмови (`/templates`, `/templates/[id]`, `…/edit`, `…/versions`, `/runs/new`).
   Перевірка ролі — як раніше, `currentUser()` (роль із `profiles` після `getClaims()`) і `templatePageAccess` до
   першого запиту даних шаблону. Мутант TS-V14: `refusalBackLink` для вендора повертає «Back to templates».
5. **«Run not found» без тексту AC-TASK-03 для вендора** (AC-VENDOR-15; AC-VENDOR-07 без змін). `VendorRun`, якщо
   запуск не знайдено серед `vendor_runs()`, показує `RunNotFound` **без** `message`; на своєму запуску — `Alert` з
   `messageForError("NOT_ALLOWED")` (текст AC-TASK-03). Для менеджера й адміністратора поведінка AC-TASK-03 / AC-TASK-10
   не змінюється. Рішення винесено в чисту функцію `vendorRunNotice(runFound, errorCode)` у `src/lib/runs/domain.ts`
   (юніт-тест + мутант TS-V15: повертає текст AC-TASK-03 і для чужого запуску).
6. **Навігація й перша сторінка вендора** (AC-VENDOR-13): уже `PageShell showTemplates={role !== "vendor"}` і
   `login` → `/runs`. Пункти навігації виносимо в чисту `navItems(role)` (`src/components/ui/page-shell.tsx` бере її
   з `src/lib/auth/nav.ts`), щоб довести юніт-тестом «лише Runs і Profile»; e2e — після входу видно список і рівно два
   пункти. Мутант TS-V13: `navItems("vendor")` з «Templates».

### UI і компоненти

7. **Сторінка й список запусків вендора** (AC-VENDOR-11, AC-VENDOR-12): уже `VendorRun` (назва випадку `h1`,
   «Your tasks: N of K done», без статусу запуску, назви й версії шаблону) і `VendorRuns` (назва випадку, статус,
   «Your tasks…»; `vendor_runs()` не повертає назви шаблону). Доводимо: тест бази — колонки `vendor_runs()` без
   `template_name`/`template_version`; e2e — на сторінці немає `template-version` і назви «Tenant move-in», у рядку
   списку немає назви шаблону. Мутант V12: `vendor_runs()` повертає `template_name`.
8. **Тексти — дослівно з AC** через `LABELS`/`MESSAGES`/`TEMPLATE_MESSAGES` (`Back to runs`, `Not enough rights`,
   `Run not found`, текст AC-TASK-03, `Your tasks: N of K done`). Компоненти — лише `@/components/ui` (`Notice`,
   `Alert`, `TextLink`), без нових кольорів (`npm run check:design`).
9. **Оновлення UI v2 (палітра A, бічна панель, меню «Theme») — окремі задачі `task/ui-*` після цих**, щоб докази AC
   зрізу 3 не змішувались зі зміною вигляду; селектори e2e (`data-testid`, ролі й тексти) у задачах UI не змінюються.

## Risks / Trade-offs

- [Однаковий код бази `NOT_ALLOWED` для AC-VENDOR-07 і AC-VENDOR-15] → різницю робить сторінка за `vendor_runs()`;
  прямий запит до REST отримує однакову відмову, що не розкриває існування запуску (вимога «discloses nothing»).
- [e2e на проді пишуть дані] → як і раніше лише синтетичні `*@example.test`, теги `@uat @writes`.
