# QA proof pack: зріз 3 — вендор як виконавець задач (AC-VENDOR-01…10)

<!--
Шаблон з koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
Попередній proof pack (зріз 2, WS8) — docs/qa/proof-pack-ws8.md.
Статус: UAT на проді виконано 09.11.2026 на `main` @ `5230d5e` (13 з 13 PASS); приймання PM — далі.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
-->

- Прод-URL: https://property-workflows-eta.vercel.app
- Зріз 3: вендор бачить і виконує лише свої задачі запуску, а менеджер призначає йому задачі (рядок roadmap PM).
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-11-01 (повторний `/requirements-sync` 2026-11-09: «Вимоги актуальні», вимоги PM після 30.10 не змінювались)
- Спека: https://github.com/yuriivynar/property-workflows/blob/aa0d673/openspec/specs/vendor-work/spec.md
- `/api/health` на момент UAT: sha `5230d5e`, db ok, 09.11.2026 (код тестів — той самий `main @ 5230d5e`, без незакомічених змін)

## Доказ на кожен AC зрізу 3

Колонки: «Тест» — правило бази на PGlite без моків (`tests/db/vendor-work.test.ts`) плюс unit-тести; «Здатен упасти» —
SQL-мутант із `scripts/mutants.mjs` (KILLED, PR #54); «Специфікація UAT» — Playwright зі `given/when/thenStep`.

| AC | Вид | Тест (рівень) | Здатен упасти | Специфікація UAT | Вердикт UAT і кадр | PR і SHA злиття |
|---|---|---|---|---|---|---|
| AC-VENDOR-01 | основний сценарій (менеджер призначає вендора) | база (PGlite): [vendor-work.test.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/db/vendor-work.test.ts) | — (не відмова) | [vendor-assign.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-assign.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-01-then-1.png) | #50 `44bfcc7`, e2e #55 `d37a9af` |
| AC-VENDOR-02 | стан даних (вибір виконавця без імен і ролей) | база (PGlite) | V02 KILLED | [vendor-assign.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-assign.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-02-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-03 | основний (вендор бачить лише свій запуск) | база (PGlite) + `src/lib/runs/domain.test.ts` | V03 KILLED | [vendor-runs.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-runs.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-03-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-04 | відмова щодо даних (без чужих задач, email, прогресу запуску) | база (PGlite) + `domain.test.ts` | V04 KILLED | [vendor-runs.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-runs.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-04-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-05 | основний (вендор позначає свою задачу) | база (PGlite) + `domain.test.ts` | суміжне правило `mark_task_done` — V07 KILLED | [vendor-runs.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-runs.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-05-then-1.png) | #50 `44bfcc7` |
| AC-VENDOR-06 | відмова (чужий запуск за прямим посиланням) | база (PGlite) | V06 KILLED | [vendor-runs.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-runs.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-06-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-07 | відмова напряму (RPC і прямий UPDATE, в обхід сторінок) | база (PGlite): правило доводить база | V07 KILLED | [vendor-forbidden.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-forbidden.spec.ts): крок «що не змінилося» | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-07-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42`, #56 `aa0d673` |
| AC-VENDOR-08 | відмова (роль: список шаблонів) | база (PGlite) + `src/lib/templates/domain.test.ts` | V08 KILLED | [vendor-forbidden.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-forbidden.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-08-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-09 | відмова напряму (запуск шаблону RPC і прямий INSERT) | база (PGlite) + `src/app/runs/new/actions.test.ts` (дія не доходить до `rpc`) | V09 KILLED | [vendor-forbidden.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-forbidden.spec.ts): крок «що не змінилося» | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-09-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42`, #56 `aa0d673` |
| AC-VENDOR-10 | стан інтерфейсу (порожній список без таблиці) | база (PGlite) + `domain.test.ts` | — (не відмова) | [vendor-runs.spec.ts](https://github.com/yuriivynar/property-workflows/blob/aa0d673/tests/e2e/vendor-runs.spec.ts) | PASS (R6), [кадр](uat/2026-11-09/frames/AC-VENDOR-10-then-1.png) | #50 `44bfcc7` |

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| AC-VENDOR-09: «current version 1» у «Дано» | На проді й у CI поточна версія шаблону не 1 (версії створюють фікстури й редагування); версію 1 без зміни даних проду не відтворити | Специфікація читає поточну версію з бази; «Тоді» (запуск не створено, список не змінився) від версії не залежить і лишається дослівним | Низький: відхилення лише в «Дано» |
| SQL-мутанти для AC-VENDOR-01, 05, 10 | Це не відмови; мутант обов'язковий лише для відмов (AC-05 покритий суміжним V07) | Тести бази та unit | Низький |
| Таблиця-сітка запусків на телефоні для читачів екрана | Не перевірено у VoiceOver/NVDA | Семантичні `th`/`td` на робочому столі, `thead` — `sr-only` | Середній для скрінрідерів на мобільному |

## A. Вимоги й спека

- `/requirements-sync` — PR «Оновлення вимог»: https://github.com/yuriivynar/property-workflows/pull/35 (`6d4c7f8`); повторно 2026-11-09: «Вимоги актуальні», зміст не змінювався
- Спека `add-vendor-assignees` — PR «Специфікація»: https://github.com/yuriivynar/property-workflows/pull/47 (`66ce665`)
- План `impl-vendor-assignees`: https://github.com/yuriivynar/property-workflows/pull/49 (`b870bdb`)
- Зміна `clarify-<зріз3>` після уточнень: PM AC не змінював
- Питання PM: https://github.com/solomchaak/property-workflows-spec/issues/41, https://github.com/solomchaak/property-workflows-spec/issues/42, https://github.com/solomchaak/property-workflows-spec/issues/44 (відповідей PM ще немає; робочі рішення позначені в коді й `design.md`)

## B. Реалізація

| PR «Реалізація» | Задача | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| https://github.com/yuriivynar/property-workflows/pull/50 | вендор — виконавець задач (міграція `20261102133035_vendor_role.sql`, права, сторінки) | AC-VENDOR-01…10 | усі треди мають відповідь: виправлено або аргумент | після злиття `44bfcc7` |
| https://github.com/yuriivynar/property-workflows/pull/54 | SQL-мутанти V02–V09, ретро | AC-VENDOR-02, 03, 04, 06, 07, 08, 09 | CodeRabbit відмовив через ліміт — рев'ю немає | не застосовно |
| https://github.com/yuriivynar/property-workflows/pull/55 | e2e-специфікації UAT | AC-VENDOR-01…10 | CodeRabbit відмовив через ліміт — рев'ю немає | не застосовно |
| https://github.com/yuriivynar/property-workflows/pull/56 | виправлення за підсумковим рев'ю: роль до запису, помилки БД | AC-VENDOR-04, 05, 07, 09 | 2 треди: виправлено (h1) і аргумент (тест сторінки) | не застосовно |

- Оновлення вигляду (Lagoon, ADR 0007): https://github.com/yuriivynar/property-workflows/pull/53 (`93c13bb`), усі знахідки CodeRabbit відповіджено
- Ворота на `main` (`CI`): https://github.com/yuriivynar/property-workflows/actions/runs/42589591257 (`aa0d673`)
- Мутації: SQL-мутанти V02–V09 — 7 з 7 KILLED (мутант V05 не потрібен), вивід — в описі https://github.com/yuriivynar/property-workflows/pull/54

## C. UAT на проді

- Звіт: [uat/2026-11-09/report.md](uat/2026-11-09/report.md) і [manifest.json](uat/2026-11-09/manifest.json), кадри — у [uat/2026-11-09/frames/](uat/2026-11-09/frames/); 13 AC (3 AC-EDITOR зі зрізу 2 і 10 AC-VENDOR): PASS 13, FAIL 0, NEEDS-HUMAN 0
- Відео й траси: не в git; вибрані відео — вкладення в описі PR здачі (`test-results/artifacts/…/video.webm`)
- Рецензент: `claude-haiku-5-5`, суперечки → `claude-sonnet-5-5`; вартість останнього прогону $0.0277 (ціни API)
- Негативний контроль (`npm run uat:nc`, 2026-11-09): NC-1 — навмисно хибне очікування в тесті, перевірка впала → FAIL (R1) попри PASS агента; NC-2 — «Тоді» у вимозі уточнено, тест і застосунок ні, перевірки пройшли, агент не погодився (Haiku NEEDS-HUMAN, Sonnet FAIL) → NEEDS-HUMAN (R3). Жоден не дає PASS.
- Дані: `@writes`: `uat-*@example.test` і запуски; прибирання зі звіту — видалено 21, лишилось 0
- Історія прогонів 09.11.2026 (чесно): перший прогін на проді дав 4 FAIL (AC-VENDOR-01, 04, 05, 07) через розбіжність даних — у шаблоні «Tenant move-in» був зайвий розділ «Test» (6 задач замість 5); власник виправив дані проду, продукт не змінювався. Другий прогін: AC-VENDOR-02 — NEEDS-HUMAN, бо розгорнутий select на кадрі обрізано фіксованою висотою (вада доказу, не продукту; PR #58, #59). Третій прогін — 13 з 13 PASS (звіт вище).

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-VENDOR-01…10 | чекає приймання PM (повідомлення в чат команди — після злиття цього PR) | — |

## D. Прод і ретро

- `/api/health` після злиття всіх задач: sha `5230d5e`, db ok (09.11.2026)
- Нові ролі й акаунти: вендор — `vendor@example.test`, `pm-vendor@example.test`; `accounts.zip` — https://github.com/yuriivynar/property-workflows/blob/a2c2bcc/accounts.zip (PR #51)
- `docs/conformance.md`: https://github.com/yuriivynar/property-workflows/blob/aa0d673/docs/conformance.md
- Ретро: https://github.com/yuriivynar/property-workflows/blob/aa0d673/docs/qa/retro-ws9.md
