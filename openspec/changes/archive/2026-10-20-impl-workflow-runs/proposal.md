# Пропозиція: реалізація першого зрізу — запуск шаблону і прогрес запуску

## Why

Реалізуємо перший зріз за власною специфікацією `openspec/specs/run-launch` і `openspec/specs/run-progress` — переклад
вимог PM зі знімка 2026-10-20 (рядок «Вимоги:» у `docs/conformance.md`: solomchaak/property-workflows-spec, джерело
issues). Специфікацію не змінюємо: це план, як саме побудувати поведінку, яку вона описує.

## What Changes

Покриває всі 18 AC специфікації двома PR «Реалізація»:

- PR 1 «Запуск шаблону» (задача 1): AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-07,
  AC-RUN-08, AC-RUN-09.
- PR 2 «Позначка задач і прогрес» (задачі 2–3): AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-05,
  AC-TASK-06, AC-TASK-07, AC-TASK-08, AC-TASK-09.
