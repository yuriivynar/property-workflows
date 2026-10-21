# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-21

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-RUN-01 | запуск шаблону створює рівно один запуск «in progress» з усіма 5 задачами «to do» | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run), `src/app/runs/new/actions.ts` | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-02 | зміна шаблону після запуску не змінює задач запуску | `supabase/migrations/20261020115705_workflow_runs.sql` (run_sections, run_tasks) | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-03 | порожня назва випадку чи лише пробіли — запуску немає, повідомлення «Enter a case name» | `src/lib/runs/domain.ts` (validateCaseName), `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run), `supabase/migrations/20261020144507_case_name_whitespace_and_template_integrity.sql` (Unicode-пробіли) | `src/lib/runs/domain.test.ts`, `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-04 | 2 задачі призначено менеджеру B, решта 3 — менеджеру A | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run), `src/app/runs/new/page.tsx` | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-05 | адміністратор запускає шаблон — один запуск, менеджер запуску — адміністратор | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run) | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-06 | менеджер, який запустив шаблон, — менеджер запуску | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run) | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-07 | назва випадку з 101 символу — запуску немає, повідомлення «Case name must be at most 100 characters» | `src/lib/runs/domain.ts` (validateCaseName), `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run) | `src/lib/runs/domain.test.ts`, `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-08 | без призначень менеджер A — виконавець усіх 5 задач | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run), `src/app/runs/new/actions.ts` | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-09 | без призначень адміністратор — виконавець усіх 5 задач | `supabase/migrations/20261020115705_workflow_runs.sql` (launch_run) | `tests/db/run-launch.test.ts` | реалізовано |
| AC-RUN-10 | у виборі виконавця менеджер бачить лише email колег, без імен і ролей | `supabase/migrations/20261021081623_staff_directory_emails_only.sql`, `src/lib/runs/domain.ts` (staffLabel), `src/app/runs/new/page.tsx` | `tests/db/run-clarify.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-RUN-11 | назва зі 100 символів з пробілом попереду — запуск є, збережено 100 символів | `supabase/migrations/20261020144507_case_name_whitespace_and_template_integrity.sql` (launch_run), `src/lib/runs/domain.ts` (validateCaseName) | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-RUN-12 | перейменування розділу й перенесення задачі в шаблоні не змінюють розділів запуску (2 і 3 задачі) | `supabase/migrations/20261020115705_workflow_runs.sql` (run_sections) | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-01 | виконавець позначає свою задачу — «done» | `supabase/migrations/20261021085138_mark_task_done_confirmation.sql` (mark_task_done), `supabase/migrations/20261020120848_run_progress.sql` (mark_task_done), `src/app/runs/[id]/actions.ts`, `src/app/runs/[id]/mark-done-button.tsx`, `src/lib/runs/domain.ts` (needsConfirmation) | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts`, `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-02 | менеджер запуску позначає задачу іншого виконавця — «done» | `supabase/migrations/20261020120848_run_progress.sql` (mark_task_done), `src/app/runs/[id]/actions.ts`, `src/lib/runs/domain.ts` (needsConfirmation) | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-03 | сторонній менеджер не може позначити задачу — лишається «to do», повідомлення | `supabase/migrations/20261020120848_run_progress.sql` (mark_task_done), `src/lib/runs/domain.ts` (messageForError), `src/app/runs/[id]/page.tsx` | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-04 | виконано третю з 3 обов'язкових задач — запуск «completed» | `supabase/migrations/20261021085138_mark_task_done_confirmation.sql` (mark_task_done), `supabase/migrations/20261020120848_run_progress.sql` (mark_task_done), `src/lib/runs/domain.ts` (needsConfirmation) | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts`, `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-05 | на сторінці запуску прогрес «2 of 5 done» | `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/lib/runs/domain.ts` (formatProgress), `src/app/runs/[id]/page.tsx` | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-06 | менеджер B бачить свій запуск і запуск, де він виконавець, але не другий запуск менеджера A | `supabase/migrations/20261020115705_workflow_runs.sql` (can_see_run), `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/app/runs/page.tsx` | `tests/db/run-progress.test.ts` | реалізовано |
| AC-TASK-07 | адміністратор позначає задачу в чужому запуску — «done» | `supabase/migrations/20261020120848_run_progress.sql` (mark_task_done), `src/lib/runs/domain.ts` (needsConfirmation) | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-08 | на сторінці запуску статус кожної з 5 задач | `supabase/migrations/20261020115705_workflow_runs.sql` (run_tasks_select_visible), `src/app/runs/[id]/page.tsx` | `tests/db/run-progress.test.ts` | реалізовано |
| AC-TASK-09 | у списку запусків прогрес «2 of 5 done» | `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/app/runs/page.tsx` | `tests/db/run-progress.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-10 | сторонній менеджер за прямим посиланням — «Run not found», жодної задачі | `supabase/migrations/20261020115705_workflow_runs.sql` (can_see_run), `src/app/runs/[id]/page.tsx` | `tests/db/run-clarify.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-11 | біля кожної задачі — email виконавця, без імен і ролей | `supabase/migrations/20261021081623_staff_directory_emails_only.sql`, `src/lib/runs/domain.ts` (staffLabel), `src/app/runs/[id]/page.tsx` | `tests/db/run-clarify.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-12 | задачі двома групами за розділами в порядку шаблону | `supabase/migrations/20261020115705_workflow_runs.sql` (run_sections), `src/app/runs/[id]/page.tsx` | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-13 | у списку і «completed» («4 of 5 done»), і «in progress» запуск | `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/app/runs/page.tsx` | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-14 | запуск «Repair» вище за «Tenant move-in»; у рядку назва випадку й шаблону | `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/app/runs/page.tsx` | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-15 | 3 задачі «required» і 2 «optional» поруч зі статусом | `src/lib/runs/domain.ts` (requiredLabel), `src/app/runs/[id]/page.tsx` | `tests/db/run-clarify.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-16 | скасування підтвердження останньої обов'язкової задачі — задача «to do», запуск «in progress» | `supabase/migrations/20261021085138_mark_task_done_confirmation.sql` (mark_task_done), `src/lib/runs/domain.ts` (needsConfirmation), `src/app/runs/[id]/mark-done-button.tsx` | `tests/db/run-clarify.test.ts`, `src/lib/runs/domain.test.ts` | реалізовано |
| AC-TASK-17 | виконавець бачить у списку прогрес «2 of 5 done» | `supabase/migrations/20261020120848_run_progress.sql` (run_overview), `src/app/runs/page.tsx` | `tests/db/run-clarify.test.ts` | реалізовано |
| AC-TASK-18 | співвиконавець бачить позначку лише на своїй задачі | `src/lib/runs/domain.ts` (canMarkTask), `src/app/runs/[id]/page.tsx` | `src/lib/runs/domain.test.ts` | реалізовано |
