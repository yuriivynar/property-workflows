# План реалізації: вендор — виконавець задач

## Why

Реалізуємо зріз 3 — специфікацію `vendor-work` і змінені вимоги `run-launch` («Email колег у виборі виконавця») та
`run-progress` («Список запусків») з архіву зміни `add-vendor-assignees` (вимога PM solomchaak/property-workflows-spec#39).

## What Changes

Покриває AC з `openspec/specs/`:

- `vendor-work`: AC-VENDOR-01, AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06, AC-VENDOR-07, AC-VENDOR-08,
  AC-VENDOR-09, AC-VENDOR-10;
- `run-launch`: AC-VENDOR-02 (і без змін — AC-RUN-10);
- `run-progress`: AC-TASK-13, AC-TASK-14, AC-TASK-17 — без змін для менеджера й адміністратора (регрес).
