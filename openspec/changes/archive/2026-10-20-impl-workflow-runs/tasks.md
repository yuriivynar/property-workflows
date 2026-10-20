# Tasks

Вертикальні задачі: кожна — таблиця/RLS + функція бази + доменна функція + server action/сторінка + тест, і кожна
робить свої AC спостережуваними сама. Кожна закінчується рядком «Done when» з AC ID; перевірка — `npm test`,
`npm run ac:coverage`. Задача 1 — PR «Реалізація» `task/run-launch`, задачі 2–3 — PR «Реалізація» `task/run-progress`.

## 1. Запуск шаблону для випадку

- [x] 1.1 Запуск шаблону: міграція ролей (`member` → `manager`, default `manager`,
  `check (role in ('manager', 'admin'))`) і `supabase/demo-users.json` (`admin@example.test`,
  `manager.a@example.test`, `manager.b@example.test`, `manager.c@example.test`); міграція схеми (`templates`,
  `template_sections`, `template_tasks`, `runs`, `run_sections`, `run_tasks` з RLS, `revoke` + явними GRANT,
  `private.can_see_run`); довідкові дані — шаблони «Tenant move-in» (2 розділи, 5 задач, 3 обов'язкові) і «Repair
  request» міграцією з `on conflict do nothing`; функції `launch_run` і `staff_directory`; сторінки `/runs` і
  `/runs/new`, server action `launchRun`, посилання з `/`; `database.types.ts`; тести бази (PGlite) і ADR про них.
  Done when: AC-RUN-01, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-08, AC-RUN-09 — менеджер і адміністратор запускають
  «Tenant move-in»: рівно один запуск «in progress» з 5 задачами «to do», менеджер запуску — той, хто запустив,
  виконавці — призначені або менеджер запуску (тести бази й preview).
- [x] 1.2 Незмінність запуску: `launch_run` копіює розділи й задачі (назви, позиції, обов'язковість) у
  `run_sections` / `run_tasks`; тест змінює шаблон після запуску.
  Done when: AC-RUN-02 — після додавання шостої задачі й перейменування першої запуск має ті самі 5 задач.
- [x] 1.3 Назва випадку: `src/lib/runs/messages.ts` і `validateCaseName` у формі; помилки `CASE_NAME_REQUIRED` /
  `CASE_NAME_TOO_LONG` у `launch_run`; повідомлення на формі `/runs/new`; тести домену й бази.
  Done when: AC-RUN-03, AC-RUN-07 — запуску немає, повідомлення «Enter a case name» і «Case name must be at most
  100 characters».
- [x] 1.4 Розділ 7 `docs/bootstrap.md` (посилання на PR #1, preview, прод-деплой); рядки AC-RUN-* у
  `docs/conformance.md` — `реалізовано`.
  Done when: AC-RUN-01…AC-RUN-09 — `npm run ac:coverage` зелений, рядки AC-RUN-* `реалізовано`.

## 2. Позначка задач і завершення запуску

- [x] 2.1 Позначка: функція `mark_task_done` (дозволи, блокування рядка запуску, повторна позначка без змін); сторінка
  `/runs/[id]` із задачами за розділами, виконавцем, «required»/«optional», статусом і кнопкою позначки з
  підтвердженням там, де дозволено; server action `markTaskDone`; тести бази.
  Done when: AC-TASK-01, AC-TASK-02, AC-TASK-07 — виконавець, менеджер запуску й адміністратор позначають задачу, вона
  «done» (тести бази й preview).
- [x] 2.2 Відмова: `NOT_ALLOWED` для того, хто не є виконавцем, менеджером запуску чи адміністратором;
  `messageForError` → текст AC-TASK-03; «Run not found» на сторінці чужого запуску.
  Done when: AC-TASK-03 — прямий виклик `mark_task_done` стороннім менеджером повертає `NOT_ALLOWED`, задача лишається
  «to do», а повідомлення дослівно «Only the task's assignee, the run manager, or an administrator can mark a task as
  done» (тести бази й домену); на preview сторінка чужого запуску — «Run not found».
- [x] 2.3 Завершення: після позначки останньої обов'язкової задачі запуск `completed`; статус видно на сторінці й у
  списку.
  Done when: AC-TASK-04 — після третьої з 3 обов'язкових задач запуск «completed».

## 3. Прогрес і видимість

- [x] 3.1 Прогрес «N of M done» з `run_overview` у списку й на сторінці запуску (`formatProgress`); тести бази й
  домену.
  Done when: AC-TASK-05, AC-TASK-09 — «2 of 5 done» на сторінці запуску і в списку.
- [x] 3.2 Статус кожної задачі на сторінці запуску для менеджера запуску й виконавців.
  Done when: AC-TASK-08 — для кожної з 5 задач видно «done» чи «to do».
- [x] 3.3 Видимість: менеджер бачить лише свої запуски й запуски, де він виконавець; адміністратор — усі; тест бази.
  Done when: AC-TASK-06 — менеджер B бачить 2 запуски з 3.
- [x] 3.4 Рядки AC-TASK-* у `docs/conformance.md` — `реалізовано`; `npx openspec archive impl-workflow-runs -y`;
  запис екрана 1–2 хв на прод-URL — коментарем у цьому PR.
  Done when: AC-TASK-01…AC-TASK-09 — `npm run ac:coverage` зелений, усі 18 рядків матриці `реалізовано`.
