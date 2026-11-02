# Tasks

Вертикальні задачі: міграція / RLS / функції бази + доменні функції + сторінки + тести; кожна закінчується рядком
«Done when» з AC ID. Перевірка — `npm test`, `npm run test:coverage`, `npm run ac:coverage`, `npm run check:design`,
`npm run check:boundary`, `npm run gates`. Задача — гілка `task/vendor-assignees` — PR «Реалізація» з CodeRabbit і
рядками `docs/conformance.md`.

## 1. Роль vendor і права в базі (`task/vendor-assignees`)

- [ ] 1.1 Міграція `…_vendor_role.sql`: `profiles_role_check` з `vendor`; RLS `templates`, `template_versions`,
  `runs`, `run_sections`, `run_tasks` за design.md (рішення 2) з хелперами в `private`; `staff_directory` з вендорами;
  `launch_run` — виконавець `vendor`; `vendor_runs()` і `vendor_run_tasks()` (`private` + обгортки `security invoker`,
  `execute` лише `authenticated`).
- [ ] 1.2 `supabase/demo-users.json`: `vendor@example.test`, `pm-vendor@example.test`; обв'язка PGlite — роль, якої
  ще немає до `stopBefore`, — після `migrateRest()`.
- [ ] 1.3 Тести бази `tests/db/vendor-work.test.ts`: призначення, довідник, список і задачі вендора, позначка власної
  задачі й підтвердження останньої обов'язкової, відмови (чужа задача, шаблони, запуск, чужий запуск); регрес усіх
  тестів бази.
  Done when: AC-VENDOR-01, AC-VENDOR-02, AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06, AC-VENDOR-07,
  AC-VENDOR-08, AC-VENDOR-09, AC-VENDOR-10 — кожен «Тоді» перевірено на справжньому Postgres прямими запитами від імені
  вендора й менеджера.

## 2. Сторінки вендора (`task/vendor-assignees`)

- [ ] 2.1 `AppRole` += `vendor`, `currentUser()`; `templatePageAccess` (`list`, `view`, `edit`, `versions` — «Not
  enough rights» вендору); відмова на `/templates`, `/templates/[id]`, `/runs/new`.
- [ ] 2.2 `/runs` — `VendorRuns` («Your tasks: N of K done», `EmptyState` «No tasks assigned to you yet.»);
  `/runs/[id]` — `VendorRun` (задачі за розділами, `MarkDoneButton` з підтвердженням останньої обов'язкової, «Run not
  found»); `formatYourTasks`, `groupBySection`; `database.types.ts`.
- [ ] 2.3 Навігація без «Templates» для вендора; після входу без посилання — `/runs`.
- [ ] 2.4 Юніт-тести доменних функцій і дії входу; рядки `docs/conformance.md` AC-VENDOR-01…10 — «реалізовано».
  Done when: AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-08, AC-VENDOR-10 — тексти й правила екранів
  перевірено юніт-тестами; `npm run ac:coverage` — 77 з 77 «реалізовано».
