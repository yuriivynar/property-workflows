# Tasks

Вертикальні задачі: міграція / RLS / функції бази + доменні функції + сторінки + тести; кожна закінчується рядком
«Done when» з AC ID. Перевірка — `npm test`, `npm run test:coverage`, `npm run ac:coverage`, `npm run check:design`,
`npm run check:boundary`, `npm run gates`. Задачі — гілка `task/vendor-assignees` — PR «Реалізація» з CodeRabbit і
рядками `docs/conformance.md`.

## 1. Вендор як виконавець (`task/vendor-assignees`)

- [x] 1.1 Призначення вендора під час запуску: роль `vendor` (міграція `…_vendor_role.sql`, `profiles_role_check`),
  `launch_run` приймає виконавцем вендора, `staff_directory` повертає й вендорів (лише `id`, `email`, лише менеджеру й
  адміністратору); `supabase/demo-users.json` — `vendor@example.test`, `pm-vendor@example.test`; обв'язка PGlite ставить
  роль, якої ще немає до `stopBefore`, після `migrateRest()`; тести бази й регрес наявних.
  Done when: AC-VENDOR-01, AC-VENDOR-02 — задачі 3 і 4 у вендора, решта в менеджера запуску; у виборі виконавця email
  менеджера B, адміністратора й вендора, без інших даних профілю.
  Рівень тесту: база (PGlite, `tests/db/vendor-work.test.ts`) + e2e UAT. Доказ відмови: SQL-мутант V02 (`staff_directory` без вендорів).

## 2. Список і сторінка запуску вендора (`task/vendor-assignees`)

- [x] 2.1 RLS `runs` / `run_sections` / `run_tasks` для вендора (хелпери в `private`), `vendor_runs()`,
  `vendor_run_tasks()` з `id`; `/runs` — `VendorRuns`, `/runs/[id]` — `VendorRun`; `formatYourTasks`, `groupBySection`,
  `database.types.ts`; навігація без «Templates» і `/runs` після входу; тести бази, юніт-тести й тест дії входу.
  Done when: AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-06, AC-VENDOR-10 — вендор бачить лише запуск зі своїми задачами й
  «Your tasks: 0 of 2 done»; рівно свої задачі з розділом, обов'язковістю й статусом, без чужих задач, email і прогресу
  запуску; чужий запуск — «Run not found»; без задач — «No tasks assigned to you yet.» без таблиці.
  Рівень тесту: база (PGlite) + unit (`domain.test.ts`) + e2e UAT. Доказ відмови: SQL-мутанти V03 (RLS `runs` для вендора), V04 (`can_see_run_task`), V06 (`vendor_run_tasks` без перевірки виконавця).

## 3. Позначка й відмови вендору (`task/vendor-assignees`)

- [x] 3.1 `mark_task_done`: право менеджера запуску — лише за поточної ролі `manager`; `MarkDoneButton` на задачах
  вендора з підтвердженням останньої обов'язкової (`needs_confirmation`); RLS `templates` і `template_versions` для
  вендора, `templatePageAccess` (`list`, `view`, `edit`, `versions`), відмова на `/templates`, `/templates/[id]`,
  `/runs/new`; тести бази й юніт-тести; рядки `docs/conformance.md` AC-VENDOR-01…10 — «реалізовано».
  Done when: AC-VENDOR-05, AC-VENDOR-07, AC-VENDOR-08, AC-VENDOR-09 — своя задача «done» і «Your tasks: 1 of 2 done»;
  прямий запит на чужу задачу нічого не змінює; на шаблонах «Not enough rights» і жодного шаблону; прямий запуск
  шаблону не створює запуску; `npm run ac:coverage` — 77 з 77 «реалізовано».
  Рівень тесту: база (PGlite) + unit + e2e UAT. Доказ відмови: SQL-мутанти V07 (`mark_task_done`), V08 (RLS `templates`), V09 (`launch_run`); правило відмови доводить тест бази без моків, моки дій доказом не є.
