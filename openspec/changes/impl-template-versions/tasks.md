# Tasks

Вертикальні задачі: кожна — міграція / RLS / функція бази + доменна функція + server action / сторінка + тести, і
кожна робить свої AC спостережуваними сама. Кожна закінчується рядком «Done when» з AC ID; перевірка — `npm test`,
`npm run ac:coverage`, `npm run check:design`, `npm run check:boundary`. Одна задача — одна гілка `task/…` — один PR
«Реалізація» з CodeRabbit, таблицею мутаційної перевірки й рядками `docs/conformance.md`.

## 1. Версії шаблонів у базі (`task/template-versions-db`)

- [x] 1.1 Міграція `…_template_versions.sql`: `templates.current_version`, `templates.has_unpublished_changes`
  (default `true`, наявні → `false`); таблиця `template_versions` (`unique (template_id, number)`, `jsonb` знімок,
  `created_by`, `created_at`); `runs.template_version`; RLS і політики на кожну операцію за таблицею design.md
  (розділ 3), `revoke all … from anon, authenticated`, явні `grant` і колонкові `grant update`; тригер
  `private.mark_unpublished`; перенесення наявних шаблонів у версію 1 і запусків — `template_version = 1`.
- [x] 1.2 Функції `save_template_version` (роль першим рядком, `TEMPLATE_NEEDS_REQUIRED_TASK`, `NO_UNPUBLISHED_CHANGES`)
  і нова `launch_run` — з поточної версії, із записом `runs.template_version`; `move_template_item` (роль `admin`
  першим рядком, обгортка `security invoker`, `execute` лише `authenticated`); тест: менеджер викликає обидві RPC
  напряму — `NOT_ALLOWED`, шаблон і позиції без змін.
- [x] 1.3 Форма запуску `/runs/new` читає задачі поточної версії (знімок), сторінка запуску показує
  «Template version N»; `database.types.ts`; регрес тестів AC-RUN-* і AC-TASK-*.
- [ ] 1.4 Тести бази `tests/db/template-versions.test.ts` на AC нижче (відмова + незмінні дані) і мутаційна перевірка:
  таблиця в PR, щонайменше два червоні прогони CI (`mutation: …` + revert); рядки `docs/conformance.md`.
  Done when: AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-06, AC-EDITOR-08 — менеджер бачить лише поточну
  версію без незбережених змін; збереження створює версію 2 з 6 задачами; без обов'язкової задачі — повідомлення й
  версії немає; запуск з версії 1 показує «Template version 1» і 5 задач; прямий запит менеджера нічого не змінює.

## 2. Редактор шаблону (`task/template-editor`)

- [ ] 2.1 `requireAdmin()` / `requireUser()` (`src/lib/auth/require-role.ts`): `getClaims()` + роль з `profiles` до
  запису; тест: менеджер отримує помилку до запису.
- [ ] 2.2 Сторінки `/templates` (список, «Create a template», `StatusBadge` «Unpublished changes»),
  `/templates/[id]` (поточна версія лише для читання), `/templates/[id]/edit` (розділи й задачі: додати,
  перейменувати, порядок, видалити, «required»; «Save»; `Alert` з помилкою), `/templates/[id]/versions` (номер,
  `formatVersionDate`, email автора); server actions з автозбереженням; посилання «Templates» у навігації.
- [ ] 2.3 `templatePageAccess`: менеджер на редакторі й списку версій — `Notice` «Not enough rights» (+ «Back to
  templates» на редакторі), дані не запитуються; відвідувач без входу — сторінка входу.
- [ ] 2.4 Тести бази й домену на AC нижче, мутаційна перевірка, рядки `docs/conformance.md`.
  Done when: AC-EDITOR-01, AC-EDITOR-05, AC-EDITOR-07, AC-EDITOR-09, AC-DSYS-02 — зміна лишається після виходу з
  позначкою «Unpublished changes»; версії від найновішої з «DD.MM.YYYY HH:MM» і email; менеджер бачить «Not enough
  rights» без версій і без редактора («Back to templates»); відвідувач без входу бачить сторінку входу.

## 3. Однакові стани сторінок (`task/design-system-states`)

- [ ] 3.1 `PageShell` (спільний макет, зокрема `/login`), `Notice`, `EmptyState` у `src/components/ui`; `DESIGN.md`,
  розділи 5–6.
- [ ] 3.2 `/runs`: `runsListState` — «No runs yet. Launch a template to start one.» + «Launch a template», без таблиці;
  статуси лише через `StatusBadge` (тест мапи); відвідувач без входу на сторінці запуску — сторінка входу, без даних.
- [ ] 3.3 ADR (версії — `jsonb`-знімок; перевірка в дії + RLS, без admin-клієнта) і правило
  `scripts/check-actions-claims.mjs` в `architecture.yml` з доказом, що воно ловить порушення (червоний прогін або
  вивід скрипта в PR).
- [ ] 3.4 Скріни за ролями (`docs/img/ws7-role-*`), рядки `docs/conformance.md`, `npx openspec archive
  impl-template-versions -y` (останній PR зрізу).
  Done when: AC-DSYS-01, AC-DSYS-03, AC-DSYS-04 — однакові слова й колір статусів у списку й на сторінці запуску;
  відвідувач без входу бачить сторінку входу в тому самому макеті без даних запуску; менеджер без запусків бачить
  порожній стан без таблиці.
