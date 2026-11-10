# Пропозиція: уточнення зрізу 3 (вендори) після відповідей PM (2026-11-10)

## Why

10.11 PM відповів на всі питання до зрізу 3 (solomchaak/property-workflows-spec#41–#50) і змінив вимоги
`requirements/39-assign-a-vendor.md` (solomchaak/property-workflows-spec#39, `> Джерело:` оновлено 2026-11-10T09:13:05Z)
і `requirements/3-complete-tasks-and-track-run-progress.md` (solomchaak/property-workflows-spec#3, оновлено
2026-11-10T09:13:07Z); знімок — PR «Оновлення вимог» #63. Специфікацію приводимо у відповідність: ID AC PM не
змінюються.

## What Changes

- **MODIFIED** AC-VENDOR-07 — на прямий запит позначити чужу задачу у своєму запуску вендор отримує повідомлення
  «Only the task's assignee, the run manager, or an administrator can mark a task as done» (solomchaak/property-workflows-spec#48).
- **MODIFIED** AC-VENDOR-08 — на відмові «Not enough rights» є посилання «Back to runs» (solomchaak/property-workflows-spec#49).
- **ADDED** AC-VENDOR-11 — сторінка запуску вендора: назва випадку заголовком і «Your tasks: N of K done», без статусу
  запуску, назви й версії шаблону (solomchaak/property-workflows-spec#41).
- **ADDED** AC-VENDOR-12 — рядок списку запусків вендора без назви шаблону (solomchaak/property-workflows-spec#42).
- **ADDED** AC-VENDOR-13 — навігація вендора лише «Runs» і «Profile», після входу — список запусків (solomchaak/property-workflows-spec#44).
- **ADDED** AC-VENDOR-14 — форма запуску, сторінка шаблону, список версій і редактор закриті вендору з «Not enough
  rights» і «Back to runs» (solomchaak/property-workflows-spec#47, solomchaak/property-workflows-spec#49).
- **ADDED** AC-VENDOR-15 — прямий запит позначити задачу запуску без власних задач — «Run not found» (solomchaak/property-workflows-spec#48).
- **ADDED** AC-VENDOR-16 — необов'язкова задача вендора після завершення запуску (solomchaak/property-workflows-spec#46).
- **ADDED** AC-VENDOR-17, AC-VENDOR-18 — прямі запити на читання: лише власні задачі власних запусків, нічого про інших
  користувачів і чужі запуски (solomchaak/property-workflows-spec#50).
- **ADDED** AC-TASK-19 — необов'язкову задачу завершеного запуску можна позначити виконаною, запуск лишається
  «completed» (solomchaak/property-workflows-spec#46; закриває Q1 вимоги solomchaak/property-workflows-spec#3).

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `vendor-work`: 3 змінені вимоги (AC-VENDOR-07 і AC-VENDOR-08 змінені, AC-VENDOR-12 і AC-VENDOR-14 додані до наявних
  вимог) і 5 нових вимог (AC-VENDOR-11, AC-VENDOR-13, AC-VENDOR-15, AC-VENDOR-16, AC-VENDOR-17, AC-VENDOR-18).
- `run-progress`: 1 нова вимога (AC-TASK-19).

## Users & roles

Без нових ролей (`manager`, `admin`, `vendor`). Матриця прав `requirements/product.md` не змінилась; уточнено, що
бачить вендор: на сторінці запуску — назву випадку й «Your tasks: N of K done»; у списку — назву випадку, статус запуску
й «Your tasks: N of K done»; у навігації — лише «Runs» і «Profile». Кожне обмеження діє й для прямих запитів: запит без
права відхиляється, нічого не змінює й нічого не розкриває (AC-VENDOR-07, AC-VENDOR-15, AC-VENDOR-17, AC-VENDOR-18).
Роль у застосунку не змінюється: `vendor` задають під час створення користувача (solomchaak/property-workflows-spec#45).

## Non-goals

Без змін (`requirements/39-assign-a-vendor.md`, «Поза межами»): прийняття чи відмова від задачі, дата візиту, файли від
вендора, зміна виконавця після запуску, запрошення й сповіщення, довідник вендорів, запуск і редагування шаблонів
вендором. Зняття позначки «done» — поза межами (`requirements/3-…`, «Поза межами»).

## Assumptions

Припущення PM:

- Вендор бачить на сторінці запуску назву випадку заголовком і «Your tasks: N of K done», без статусу запуску, назви
  шаблону й версії; рядок списку запусків — назва випадку, статус запуску й «Your tasks: N of K done», без назви шаблону.
- Навігація вендора — лише «Runs» і «Profile»; після входу вендор потрапляє на список запусків.
- Кожна сторінка, закрита вендору (форма запуску, список і сторінка шаблону, список версій, редактор), показує «Not
  enough rights» і посилання «Back to runs».
- Роль у застосунку цього зрізу не змінюється: `vendor` задають під час створення користувача, для іншої ролі
  адміністратор створює нового користувача (solomchaak/property-workflows-spec#45).
- Необов'язкову задачу завершеного запуску можна позначити виконаною будь-якою роллю, зокрема вендором; запуск лишається
  «completed» (AC-TASK-19, AC-VENDOR-16).
- Підтвердження з «This cannot be undone» вендор бачить лише на останній обов'язковій задачі запуску, і з нього може
  дізнатися, що інші обов'язкові задачі виконано, — PM це прийняв (solomchaak/property-workflows-spec#43).

Власні припущення (розробник):

- AC-VENDOR-13 описує звичайний вхід. Вхід за прямим посиланням для вендора — як для всіх (AC-DSYS-08): показуємо
  сторінку посилання з правами вендора, тобто «Not enough rights» чи «Run not found», якщо вона йому закрита.

## Open questions

Немає: PM відповів на всі питання зрізу 3 (solomchaak/property-workflows-spec#41–#50).
