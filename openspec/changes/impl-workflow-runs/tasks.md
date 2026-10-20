# Tasks

Вертикальні задачі: кожна — таблиця/RLS + функція бази + доменна функція + server action/сторінка + тест. Кожна
закінчується рядком «Done when» з AC ID; перевірка — `npm test`, `npm run ac:coverage`. Задачі 1–2 — PR «Реалізація»
`task/run-launch`, задачі 3–4 — PR «Реалізація» `task/run-progress`.

## 1. Основа: ролі, модель даних, довідкові дані

- [ ] 1.1 Міграція ролей: `member` → `manager`, default `manager`, `check (role in ('manager', 'admin'))`;
  `supabase/demo-users.json` — `admin@example.test`, `manager.a@example.test`, `manager.b@example.test`,
  `manager.c@example.test`.
  Done when: AC-RUN-05, AC-RUN-06 — у тестовій базі (PGlite) профілі мають ролі `manager`/`admin`, і менеджер
  запуску — той, хто запустив шаблон.
- [ ] 1.2 Міграція схеми: `templates`, `template_sections`, `template_tasks`, `runs`, `run_sections`, `run_tasks` з
  RLS, `revoke` + явними GRANT (лише select для `authenticated`), `private.can_see_run`; подання `run_overview`
  (`security_invoker`); `database.types.ts`.
  Done when: AC-RUN-01 — запуск має статус «in progress» і всі задачі «to do».
- [ ] 1.3 Міграція довідкових даних: шаблони «Tenant move-in» (2 розділи, 5 задач, 3 обов'язкові) і «Repair request»
  з `on conflict do nothing`.
  Done when: AC-RUN-01 — шаблон «Tenant move-in» з 2 розділами і 5 задачами є в тестовій базі.

## 2. Запуск шаблону

- [ ] 2.1 Функції `private.launch_run` + `public.launch_run` (копія розділів і задач, менеджер запуску, виконавці,
  перевірка назви випадку) і `staff_directory`; тести бази.
  Done when: AC-RUN-01, AC-RUN-02, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-08, AC-RUN-09.
- [ ] 2.2 `src/lib/runs/messages.ts` і `validateCaseName`; помилки `CASE_NAME_REQUIRED` / `CASE_NAME_TOO_LONG` у
  `launch_run`; тести домену й бази.
  Done when: AC-RUN-03, AC-RUN-07 — запуску немає, повідомлення «Enter a case name» і «Case name must be at most
  100 characters».
- [ ] 2.3 Сторінки `/runs` (список видимих запусків) і `/runs/new` (шаблон → назва випадку → виконавці задач за
  розділами) і server action `launchRun`; посилання з `/`; розділ 7 `docs/bootstrap.md`; ADR про тести бази (PGlite).
  Done when: AC-RUN-01, AC-RUN-04, AC-RUN-08 — на preview менеджер запускає шаблон і бачить запуск із виконавцями.

## 3. Позначка задач і завершення запуску

- [ ] 3.1 Функції `private.mark_task_done` + `public.mark_task_done`: дозволи, повторна позначка без змін, завершення
  запуску; тести бази.
  Done when: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-07.
- [ ] 3.2 Сторінка `/runs/[id]`: задачі за розділами з виконавцем, «required»/«optional» і статусом; кнопка позначки з
  підтвердженням лише там, де дозволено; server action `markTaskDone` і повідомлення AC-TASK-03; «Run not found» для
  чужого запуску.
  Done when: AC-TASK-01, AC-TASK-03, AC-TASK-08 — на preview виконавець позначає задачу, сторонній менеджер бачить
  повідомлення.

## 4. Прогрес і видимість

- [ ] 4.1 Прогрес «N of M done» з `run_overview` у списку й на сторінці запуску (`formatProgress`); статус запуску в
  рядку списку; тести бази й домену.
  Done when: AC-TASK-05, AC-TASK-09.
- [ ] 4.2 Видимість: менеджер бачить лише свої запуски й запуски, де він виконавець; адміністратор — усі; тест бази.
  Done when: AC-TASK-06.
- [ ] 4.3 Рядки `docs/conformance.md` — `реалізовано`; `npx openspec archive impl-workflow-runs -y` в останньому PR
  задачі; запис екрана 1–2 хв на прод-URL — коментарем у цьому PR.
  Done when: AC-TASK-01…AC-TASK-09 — `npm run ac:coverage` зелений, усі 18 рядків матриці `реалізовано`.
