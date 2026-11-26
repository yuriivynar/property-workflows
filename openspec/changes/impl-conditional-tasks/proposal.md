# План: задача лише для певної відповіді (зріз 5)

## Why

Реалізуємо можливість `conditional-tasks` і змінені вимоги «Прогрес запуску» та «Завершення запуску» можливості
`run-progress` (зміна специфікації `add-conditional-tasks`, вимога PM solomchaak/property-workflows-spec#51).

## What Changes

AC з `openspec/specs/`, які покриває зміна:

- AC-LOGIC-01, AC-LOGIC-02, AC-LOGIC-03, AC-LOGIC-04, AC-LOGIC-05;
- без змін поведінки, але з новим правилом підрахунку лише показаних задач: AC-TASK-04, AC-TASK-05, AC-TASK-09,
  AC-TASK-16, AC-TASK-17, AC-VENDOR-04, AC-VENDOR-11.
