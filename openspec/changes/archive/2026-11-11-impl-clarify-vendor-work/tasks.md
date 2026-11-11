# Tasks

Одна задача — одна гілка — один PR «Реалізація» з CodeRabbit і рядками `docs/conformance.md` її AC. Перевірка —
`npm run lint`, `npm run typecheck`, `npm test`, `npm run ac:coverage`, `npm run check:design`, `npm run check:boundary`,
`node scripts/mutation-check.mjs --only <id мутантів задачі>` (SQL- і TS-мутанти; `npm run mutation:sql` — усі SQL). Правило відмови доводить тест бази без моків або юніт-тест чистої функції;
моки дій доказом не є. Архів `impl-clarify-vendor-work` — в останньому PR задач 1–4.

## 1. Відмови вендору (`task/vendor-refusals`)

- [x] 1.1 `refusalBackLink(role)` для всіх сторінок відмови шаблонів і `/runs/new`; `vendorRunNotice(runFound,
  errorCode)` у `VendorRun`: на своєму запуску — текст AC-TASK-03, на запуску без своїх задач — лише «Run not found»;
  юніт-тести, тести бази (AC-VENDOR-07: код `NOT_ALLOWED`, статус «to do»; AC-VENDOR-15: те саме для запуску без
  задач), e2e `vendor-forbidden.spec.ts` (посилання «Back to runs» на п'яти сторінках, повідомлення AC-07/AC-15);
  мутанти TS-V14, TS-V15 у `scripts/mutants.mjs`; рядки матриці AC-VENDOR-07, 08, 14, 15 — «реалізовано».
  Рівень тесту: unit + база (PGlite) + e2e UAT. Доказ відмови: мутанти V07, V08 (наявні), TS-V14, TS-V15.
  Done when: AC-VENDOR-07, AC-VENDOR-08, AC-VENDOR-14, AC-VENDOR-15 — чужа задача у своєму запуску лишається «to do» з
  текстом AC-TASK-03; у запуску без своїх задач — «to do» і «Run not found»; на списку й сторінці шаблону, формі
  запуску, списку версій і в редакторі — «Not enough rights», «Back to runs» і жодного вмісту шаблону.

## 2. Що бачить вендор (`task/vendor-views`)

- [x] 2.1 `navItems(role)` у `src/lib/auth/nav.ts` (бере `PageShell`); тест бази: колонки `vendor_runs()` без назви й
  версії шаблону; юніт-тест навігації й дії входу; e2e: заголовок сторінки запуску — назва випадку, «Your tasks: 1 of 2
  done», без статусу запуску, назви й версії шаблону; рядок списку без «Tenant move-in»; після входу — список і лише
  «Runs», «Profile»; мутанти V12 (SQL), TS-V13; рядки матриці AC-VENDOR-11, 12, 13.
  Рівень тесту: unit + база (PGlite) + e2e UAT. Доказ відмови: мутанти V12, TS-V13.
  Done when: AC-VENDOR-11, AC-VENDOR-12, AC-VENDOR-13.

## 3. Прямі читання вендора (`task/vendor-direct-reads`)

- [x] 3.1 Тести бази від імені вендора: `run_tasks`, `run_sections`, `runs`, `run_overview`, `profiles`,
  `staff_directory()`, `vendor_run_tasks()` для свого й чужого запуску; мутанти V04, V06 (наявні, і для AC-VENDOR-17), V18, V18P;
  рядки матриці AC-VENDOR-17, 18.
  Рівень тесту: база (PGlite). Доказ відмови: мутанти V04, V06, V18, V18P.
  Done when: AC-VENDOR-17, AC-VENDOR-18 — прямий запит задач свого запуску повертає лише задачі 3 і 4; email, профілі
  інших і задачі «Apartment 14, repair» — нічого.

## 4. Необов'язкова задача завершеного запуску (`task/optional-after-completed`)

- [x] 4.1 Тести бази: менеджер-виконавець і вендор позначають необов'язкову задачу запуску `completed` — «done», запуск
  лишається `completed`, прогрес / «Your tasks» її рахує; юніт-тест `canMarkTask` (кнопку пропонують і в завершеному
  запуску); e2e для AC-TASK-19 і AC-VENDOR-16; мутант T19; рядки матриці AC-TASK-19, AC-VENDOR-16; archive
  `impl-clarify-vendor-work`.
  Рівень тесту: unit + база (PGlite) + e2e UAT. Доказ відмови: мутант T19.
  Done when: AC-TASK-19, AC-VENDOR-16 — задача «done», запуск «completed», прогрес «… done» і «Your tasks: 1 of 1 done»;
  `npm run ac:coverage` — 86 з 86 «реалізовано».

## Після задач

- UI v2 — окремі задачі `task/ui-*` (палітра A + ADR, бічна панель і меню «Theme», вхід, хлібні крихти й рядки-посилання),
  селектори e2e не змінюються; потім UAT на проді й proof pack.
