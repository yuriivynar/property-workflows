# Задачі: задача лише для певної відповіді (зріз 5)

## 1. База: поля, умови, відповідь, прогрес лише за показаними

- [ ] 1.1 Міграція: `template_fields`, умова на `template_tasks`, `run_fields`, умова й `is_shown` на `run_tasks`; RLS і
  гранти; `template_snapshot` і `launch_run` з полями
- [ ] 1.2 `private.set_run_field_answer` (усі чотири умови `security definer`) і обгортка `public.set_run_field_answer`
- [ ] 1.3 `run_overview`, `mark_task_done`, `vendor_runs`, `vendor_run_tasks` — лише показані задачі
- [ ] 1.4 Початкові дані: шаблон «Repair» з полем «Urgency» і задачею «Send an emergency plumber»
- [ ] 1.5 `database.types.ts`; PGlite-тести `tests/db/conditional-tasks.test.ts`
- Done when: AC-LOGIC-01, AC-LOGIC-02, AC-LOGIC-03, AC-LOGIC-04, AC-LOGIC-05 (у базі); наявні AC-TASK-*, AC-VENDOR-* і
  AC-RUN-02 зелені

## 2. Сторінка запуску: Urgency у картці деталей і рядок-«привид»

- [ ] 2.1 Server Action `setRunFieldAnswer` (роль до запису, текст AC-LOGIC-05)
- [ ] 2.2 Властивість «Urgency» в картці деталей (меню з крапкою й описом), «привид» у розділі з «Set Urgency»
- [ ] 2.3 `domain.ts`: прогрес і підтвердження лише за показаними; тести дії й компонента
- Done when: AC-LOGIC-01, AC-LOGIC-02, AC-LOGIC-05 на сторінці; AC-LOGIC-03 і AC-LOGIC-04 через ту саму дію
