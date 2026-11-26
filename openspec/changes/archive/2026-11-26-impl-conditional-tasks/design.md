# Дизайн: задача лише для певної відповіді (зріз 5)

Реалізуємо `openspec/specs/conditional-tasks/spec.md` (AC-LOGIC-01…05, вимога PM solomchaak/property-workflows-spec#51)
і MODIFIED «Прогрес запуску» / «Завершення запуску» в `openspec/specs/run-progress/spec.md`. Вигляд — полотно UI v3,
варіант «detail» (рішення власника 2026-11-26, ADR 0012).

## Модель даних (одна міграція)

Шаблон (ADR 0002: версії — JSONB-знімки):

- `template_fields` — поле-вибір шаблону: `id`, `template_id` (cascade), `name`, `options text[]` (≥ 2 різні непорожні),
  `position`; unique (`template_id`, `name`). Редактора немає (Non-goals): поля — лише початкові дані міграцій.
- `template_tasks.show_when_field_id` (→ `template_fields`, `on delete set null`) і `show_when_value text`; check: обидва
  null або обидва задані; значення — одне з `options` поля (тригер, бо check не бачить іншої таблиці).
- `private.template_snapshot` додає `fields: [{id, name, options, position}]` і в задачі — `show_when: {field_id, value}`
  (лише коли задано). Старі версії без `fields` — `coalesce(…, '[]')`: наявні шаблони й запуски не змінюються (AC-RUN-02).

Запуск (запуск зберігає поле, умову й відповідь, з якими його запущено — «Припущення» PM):

- `run_fields` — копія поля: `id`, `run_id` (cascade), `name`, `options text[]`, `position`, `answer text null`; check
  `answer is null or answer = any(options)`. Відповідь зберігається як у PM — `urgent` / `not urgent`; підпис
  «Urgent» / «Not urgent» — лише в інтерфейсі (рішення власника).
- `run_tasks.show_when_field_id` (→ `run_fields`, cascade), `show_when_value`, `is_shown boolean not null default true`.
  `is_shown` — денормалізація, яку пишуть лише функції `launch_run` і `set_run_field_answer` (у `authenticated` немає
  `update` на `run_tasks`): прогрес, завершення, RLS і сторінки читають одне поле, а не повторюють умову.
- `launch_run`: копіює `fields` у `run_fields` (answer null), задачі з умовою — `is_shown = false` (поле без відповіді
  не відповідає жодній умові, AC-LOGIC-01).

## Функція зміни відповіді (атомарно, AC-LOGIC-02, -04, -05)

`public.set_run_field_answer(p_field_id uuid, p_answer text)` — `security invoker` обгортка над
`private.set_run_field_answer` (`security definer`, `set search_path = ''`, `revoke execute … from public, anon`,
перевірка доступу до рядка — усі чотири умови AGENTS.md):

1. роль — `admin` або `manager`, що є `runs.run_manager_id`; інакше `ANSWER_NOT_ALLOWED` (`42501`) → дія показує
   «Only the run manager or an administrator can change the answers» (AC-LOGIC-05); виконавець задачі й вендор — відмова;
2. `p_answer` — одне з `options` (або null — «без відповіді»), інакше `INVALID_ANSWER`;
3. `for update` на рядку `runs` (як у `mark_task_done`); та сама відповідь — нічого не змінює;
4. зберегти відповідь; кожну задачу, умова якої залежить від цього поля, — `status = 'to_do'` і
   `is_shown = (show_when_value = p_answer)` (AC-LOGIC-02, AC-LOGIC-04: «done» повертається до «to do»);
5. статус запуску перераховується за показаними обов'язковими задачами: усі «done» — `completed`, інакше
   `in_progress` (рішення розробника: PM не описує зміну відповіді в завершеному запуску; правило те саме, що
   «Завершення запуску»).

## Прогрес і завершення лише за показаними задачами (AC-LOGIC-01, -03; AC-TASK-04, -05, -09, -16, -17)

- `run_overview`: `done_count` і `total_count` — `filter (where t.is_shown)`.
- `mark_task_done`: прихована задача — `NOT_ALLOWED`; «остання обов'язкова» і завершення — лише серед `is_shown`
  (AC-LOGIC-03).
- `vendor_runs`, `vendor_run_tasks`: лише `is_shown` (вендор бачить лише свої показані задачі — «Користувачі й ролі» PM).
- `src/lib/runs/domain.ts` (`needsConfirmation`, підрахунок прогресу на сторінці) — лише показані задачі.

## RLS

- `run_fields`: `enable row level security`; `revoke all … from anon, authenticated`; `grant select` → політика
  `select to authenticated using (private.can_see_run(run_id) and (select private.current_app_role()) <> 'vendor')`.
  Запису напряму немає — лише функція.
- `template_fields`: select — як `templates` (admin — усі, manager — збережені, vendor — нічого).
- `run_tasks` select: вендор додатково лише `is_shown`; менеджер і адміністратор бачать і приховані — для рядка-«привида».

## Початкові дані (AC-LOGIC-01)

Новий шаблон «Repair» (версія 1, без незбережених змін): розділ(и) з 4 обов'язковими задачами, одна з яких — «Send an
emergency plumber» з умовою «Urgency» = `urgent`; поле «Urgency» з відповідями `urgent`, `not urgent`. Новий шаблон, тож
наявні шаблони й запуски не змінюються.

## Server Action і сторінка запуску

- `setRunFieldAnswer` у `src/app/runs/[id]/actions.ts`: `getClaims()` + роль з `profiles` до `rpc`; zod: `fieldId`
  uuid, `answer` — рядок або порожньо; помилка `42501` → текст AC-LOGIC-05 дослівно; `revalidatePath`.
- Картка деталей запуску (права): властивість «Urgency» — кнопка-меню (`DropdownMenu`) з кольоровою крапкою й рядком
  опису ефекту під кожною відповіддю; «No answer», поки відповіді немає. Лише менеджеру запуску й адміністратору — меню;
  виконавцю — текст відповіді; вендору — нічого.
- Прихована задача — пунктирний рядок-«привид» у своєму розділі: назва, «Shown when Urgency is Urgent» і кнопка «Set
  Urgency» (відкриває те саме меню). Вендору й виконавцям, що не можуть змінити відповідь, «привида» не показуємо.
- Тексти статусів і повідомлень — дослівно з AC.

## Тести

- PGlite (`tests/db/conditional-tasks.test.ts`): AC-LOGIC-01…05, вендор не бачить `run_fields` і прихованих задач,
  повторна та сама відповідь, недопустима відповідь, `run_overview` рахує лише показані.
- Дія (`src/app/runs/[id]/actions.test.ts` або поруч): роль до `rpc`, текст AC-LOGIC-05.
- Компонент: «привид», меню відповіді, підписи «Urgent» / «Not urgent».
