# Пропозиція: план реалізації зрізу 2 — версії шаблонів і дизайн-система

## Why

Реалізуємо зріз 2 зі специфікацій `openspec/specs/template-versions` і `openspec/specs/design-system` (переклад вимог PM
solomchaak/property-workflows-spec#20 і solomchaak/property-workflows-spec#19, знімок 2026-10-25): адміністратор
редагує шаблон і зберігає його пронумерованою версією, менеджери працюють лише з поточною версією, запуск показує свою
версію, а сторінки однаково показують статуси, відмови, вхід і порожні стани. Інфраструктура дизайн-системи (токени,
компоненти, `StatusBadge`) уже на `main` (PR #13); тут — поведінка з AC.

## What Changes

Покриває AC зі специфікацій зрізу 2:

- `template-versions`: AC-EDITOR-01, AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-05, AC-EDITOR-06,
  AC-EDITOR-07, AC-EDITOR-08, AC-EDITOR-09;
- `design-system`: AC-DSYS-01, AC-DSYS-02, AC-DSYS-03, AC-DSYS-04.

Поведінка зрізу 1 (AC-RUN-01…12, AC-TASK-01…18) зберігається: її тести мають лишитися зеленими після переходу запуску
на поточну версію шаблону.
