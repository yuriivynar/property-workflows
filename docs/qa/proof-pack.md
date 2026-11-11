# QA proof pack: зріз 3 — вендор як виконавець задач (AC-VENDOR-01…18, AC-TASK-19)

<!--
Шаблон з koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
Попередні proof pack: зріз 3 до уточнень PM (09.11, AC-VENDOR-01…10) — docs/qa/proof-pack-ws9-slice3.md, зріз 2 (WS8) — docs/qa/proof-pack-ws8.md.
Статус: UAT на проді виконано 11.11.2026 на `main` @ `41b1da5` (20 з 20 PASS); приймання PM — далі.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
-->

- Прод-URL: https://property-workflows-eta.vercel.app
- Що змінилось: PM 10.11 відповів на питання зрізу 3 (solomchaak/property-workflows-spec#41–#50) і оновив
  solomchaak/property-workflows-spec#39 і solomchaak/property-workflows-spec#3. Змінено тексти AC-VENDOR-07 і AC-VENDOR-08,
  додано AC-VENDOR-11…18 і AC-TASK-19.
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-11-10
- Спека: [vendor-work/spec.md](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/openspec/specs/vendor-work/spec.md),
  [run-progress/spec.md](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/openspec/specs/run-progress/spec.md)
- `/api/health` на момент UAT: sha `41b1da5`, env production, db ok, 11.11.2026 (код тестів — той самий `main @ 41b1da5`)

## Доказ на кожен AC зрізу 3

Колонки:

- «Тест» — тест бази на PGlite без моків або юніт-тест чистої функції, якщо правило живе в ній.
- «Здатен упасти» — мутант зі `scripts/mutants.mjs` (KILLED).
- «Специфікація UAT» — Playwright зі `given/when/thenStep`.

Посилання — на коміт `41b1da5`.

| AC | Вид | Тест (рівень) | Здатен упасти | Специфікація UAT | Вердикт UAT і кадр | PR і SHA злиття |
|---|---|---|---|---|---|---|
| AC-VENDOR-01 | основний (менеджер призначає вендора) | база: [vendor-work.test.ts#L77](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L77) | — (не відмова) | [vendor-assign.spec.ts#L29](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-assign.spec.ts#L29) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-01-then-1.png) | #50 `44bfcc7`, e2e #55 `d37a9af` |
| AC-VENDOR-02 | стан даних (вибір виконавця — лише email) | база: [vendor-work.test.ts#L84](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L84) | V02 KILLED ([mutants.mjs#L46](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L46), PR #54) | [vendor-assign.spec.ts#L106](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-assign.spec.ts#L106) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-02-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-03 | основний (вендор бачить лише свій запуск) | база: [vendor-work.test.ts#L95](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L95) | V03 KILLED ([mutants.mjs#L52](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L52), PR #54) | [vendor-runs.spec.ts#L24](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L24) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-03-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-04 | відмова щодо даних (без чужих задач, email, прогресу запуску) | база: [vendor-work.test.ts#L111](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L111), [vendor-work.test.ts#L131](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L131) | V04 KILLED ([mutants.mjs#L58](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L58), PR #54) | [vendor-runs.spec.ts#L77](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L77) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-04-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-05 | основний (вендор позначає свою задачу) | база: [vendor-work.test.ts#L266](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L266), [vendor-work.test.ts#L281](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L281) | суміжне правило `mark_task_done`: V07 KILLED ([mutants.mjs#L70](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L70), PR #54) | [vendor-runs.spec.ts#L148](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L148) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-05-then-1.png) | #50 `44bfcc7` |
| AC-VENDOR-06 | відмова (чужий запуск за прямим посиланням) | база: [vendor-work.test.ts#L142](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L142) | V06 KILLED ([mutants.mjs#L64](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L64), PR #54) | [vendor-runs.spec.ts#L209](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L209) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-06-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42` |
| AC-VENDOR-07 (змінено) | відмова напряму (позначка чужої задачі у своєму запуску) | база: [vendor-work.test.ts#L303](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L303), [#L337](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L337); юніт (текст відмови AC-TASK-03): [runs/domain.test.ts#L214](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/runs/domain.test.ts#L214) | V07 KILLED ([mutants.mjs#L70](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L70)) | [vendor-forbidden.spec.ts#L45](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-forbidden.spec.ts#L45) | PASS (R6, Sonnet), [кадр](uat/2026-11-11/frames/AC-VENDOR-07-then-1.png) | #66 `d710ed1` |
| AC-VENDOR-08 (змінено) | відмова (роль: список шаблонів, «Back to runs») | база: [vendor-work.test.ts#L361](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L361); юніт: [templates/domain.test.ts#L31](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/templates/domain.test.ts#L31) | V08 KILLED ([#L76](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L76)), TS-V14 KILLED ([#L92](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L92)) | [vendor-forbidden.spec.ts#L125](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-forbidden.spec.ts#L125) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-08-then-1.png) | #66 `d710ed1` |
| AC-VENDOR-09 | відмова напряму (запуск шаблону RPC і прямий INSERT) | база: [vendor-work.test.ts#L373](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L373) | V09 KILLED ([mutants.mjs#L82](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L82), PR #54) | [vendor-forbidden.spec.ts#L168](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-forbidden.spec.ts#L168): крок «що не змінилося» | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-09-then-1.png) | #50 `44bfcc7`, #54 `0fe7f42`, #56 `aa0d673` |
| AC-VENDOR-10 | стан інтерфейсу (порожній список без таблиці) | база: [vendor-work.test.ts#L152](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L152) | — (не відмова) | [vendor-runs.spec.ts#L261](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L261) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-10-then-1.png) | #50 `44bfcc7` |
| AC-VENDOR-11 | стан інтерфейсу (заголовок запуску вендора без статусу й шаблону) | база (`vendor_runs`): [vendor-work.test.ts#L164](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L164) | — (не відмова; дані рядка доводить V12) | [vendor-runs.spec.ts#L304](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L304) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-11-then-1.png) | #67 `30903aa` |
| AC-VENDOR-12 | стан даних (рядок списку без назви шаблону) | база: [vendor-work.test.ts#L186](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L186) | V12 KILLED ([#L105](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L105)) | [vendor-runs.spec.ts#L359](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L359) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-12-then-1.png) | #67 `30903aa`, клікабельний рядок — #73 `da32b1a` |
| AC-VENDOR-13 | основний (вхід вендора, навігація Runs · Profile) | юніт: [nav.test.ts#L5](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/auth/nav.test.ts#L5), [login/actions.test.ts#L59](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/app/login/actions.test.ts#L59) | TS-V13 KILLED ([#L111](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L111)) | [vendor-runs.spec.ts#L415](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-runs.spec.ts#L415) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-13-then-1.png) | #67 `30903aa` |
| AC-VENDOR-14 | відмова (форма запуску, шаблон, версії, редактор) | юніт: [templates/domain.test.ts#L42](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/templates/domain.test.ts#L42), [require-role.test.ts#L18](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/auth/require-role.test.ts#L18); база (шаблони вендору не читаються): [vendor-work.test.ts#L361](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L361) | TS-V14 KILLED ([#L92](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L92)), V08 KILLED | [vendor-forbidden.spec.ts#L258](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-forbidden.spec.ts#L258) | PASS (R6), кадри [1](uat/2026-11-11/frames/AC-VENDOR-14-then-1.png) · [2](uat/2026-11-11/frames/AC-VENDOR-14-then-2.png) · [3](uat/2026-11-11/frames/AC-VENDOR-14-then-3.png) · [4](uat/2026-11-11/frames/AC-VENDOR-14-then-4.png) | #66 `d710ed1`, кадр — #74 `41b1da5` |
| AC-VENDOR-15 | відмова напряму (позначка в запуску без задач вендора — лише «Run not found») | база: [vendor-work.test.ts#L317](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L317); юніт: [runs/domain.test.ts#L222](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/runs/domain.test.ts#L222) | TS-V15 KILLED ([#L98](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L98)), відмову в базі — V07 | [vendor-forbidden.spec.ts#L312](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/vendor-forbidden.spec.ts#L312) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-VENDOR-15-then-1.png) | #66 `d710ed1` |
| AC-VENDOR-16 | основний (необов'язкова задача вендора в запуску «completed») | база: [vendor-work.test.ts#L237](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L237); юніт: [runs/domain.test.ts#L207](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/runs/domain.test.ts#L207) | T19 KILLED ([#L131](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L131)) — та сама гілка `mark_task_done` | [optional-after-completed.spec.ts#L98](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/optional-after-completed.spec.ts#L98) | PASS (R6), кадри [1](uat/2026-11-11/frames/AC-VENDOR-16-then-1.png) · [2](uat/2026-11-11/frames/AC-VENDOR-16-then-2.png) | #70 `d20d5fd`, кадри — #74 `41b1da5` |
| AC-VENDOR-17 | відмова щодо даних (прямий запит задач — лише свої) | база: [vendor-work.test.ts#L198](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L198) | V04 і V06 KILLED ([#L58](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L58), [#L64](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L64)) | — (прямий запит до API, див. «Не перевірено») | — | #68 `698201c` |
| AC-VENDOR-18 | відмова щодо даних (email і профілі інших, задачі інших запусків) | база: [vendor-work.test.ts#L215](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/vendor-work.test.ts#L215) | V18 KILLED ([#L118](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L118)), V18P KILLED ([#L124](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L124)) | — (прямий запит до API, див. «Не перевірено») | — | #68 `698201c` |
| AC-TASK-19 | основний (необов'язкова задача запуску «completed») | база: [run-progress.test.ts#L279](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/db/run-progress.test.ts#L279); юніт: [runs/domain.test.ts#L195](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/src/lib/runs/domain.test.ts#L195) | T19 KILLED ([#L131](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/scripts/mutants.mjs#L131)) | [optional-after-completed.spec.ts#L31](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/tests/e2e/optional-after-completed.spec.ts#L31) | PASS (R6), [кадр](uat/2026-11-11/frames/AC-TASK-19-then-1.png) | #70 `d20d5fd`, кадр — #74 `41b1da5` |

Зріз 3 цілком — 19 AC: AC-VENDOR-01…10 (вимога PM 30.10), AC-VENDOR-07/08 змінені й AC-VENDOR-11…18 (уточнення 10.11),
AC-TASK-19 (уточнення 10.11 у вимозі #3). Вердикти й кадри — з одного прогону 11.11 на UI v2. Регресія зрізу 2 в тому
самому прогоні: AC-EDITOR-07, 09, 19 — PASS (R6).

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| AC-VENDOR-17, AC-VENDOR-18 — кадр UAT | Це прямі запити до API в обхід сторінок. На сторінці нічого видимого немає, тож кадру «Тоді» немає що показати | Тести бази на PGlite без моків (RLS і `security definer`-функції), мутанти V04, V06, V18, V18P — KILLED | Низький: правило живе в базі, а не в інтерфейсі |
| AC-TASK-19: задача «Order a part» | У шаблоні «Tenant move-in» на проді такої задачі немає | Специфікація бере необов'язкову задачу шаблону («Order cleaning»). Кадр показує її «done», запуск «completed» і «4 of 5 done»; «3 of 5 done» до дії перевірено в «Дано» | Низький: відхилення лише в назві з прикладу |
| AC-VENDOR-09: «current version 1» у «Дано» | На проді поточна версія шаблону не 1 (версії створюють фікстури й редагування); версію 1 без зміни даних проду не відтворити | Специфікація читає поточну версію з бази; «Тоді» (запуск не створено, список не змінився) від версії не залежить | Низький: відхилення лише в «Дано» |
| SQL-мутанти для AC-VENDOR-01, 05, 10, 11, 16 | Це не відмови; мутант обов'язковий лише для відмов (AC-VENDOR-05 і 16 покривають суміжні V07 і T19) | Тести бази та юніт | Низький |
| Таблиця-сітка запусків на телефоні для читачів екрана | Не перевірено у VoiceOver/NVDA | Семантичні `th`/`td`, `thead` — `sr-only` | Середній для скрінрідерів на мобільному |
| AC-LOGIC-01…05 (solomchaak/property-workflows-spec#51) | Свідомо не перекладено й не реалізовано: рішення розробника до окремої команди | `ac:coverage` попереджає (WARN), у матриці цих рядків немає | — (поза цим зрізом) |
| CI `e2e` для #73 і #74 | 11.11 з 14:28 до 16:40 UTC раннери GitHub не резолвили `archive.ubuntu.com`, тож Chromium не встановлювався і тести не стартували | #73: повний набір на Vercel preview (sha `2b2bdcd`) — 23 passed; #74: змінені специфікації на проді — passed; потім повний UAT з `main` | Низький: ворота ruleset (`spec`, `app`, `conformance`, `db-check`) зелені |

## A. Вимоги й спека

- `/requirements-sync` — PR «Оновлення вимог»: https://github.com/yuriivynar/property-workflows/pull/63 (`5e37505`), знімок 2026-11-10
- Зміна специфікації `clarify-vendor-work` (MODIFIED AC-VENDOR-07/08 і «Шаблони недоступні вендору»; ADDED AC-VENDOR-11…18, AC-TASK-19) — PR «Специфікація»: https://github.com/yuriivynar/property-workflows/pull/64 (`45847f9`)
- План `impl-clarify-vendor-work` (4 задачі): https://github.com/yuriivynar/property-workflows/pull/65 (`bb7a3e7`); архів — у #70
- Відповіді PM: solomchaak/property-workflows-spec#41–#50, журнал — [docs/spec-reading.md](https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/docs/spec-reading.md)

## B. Реалізація

| PR «Реалізація» | Задача | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| https://github.com/yuriivynar/property-workflows/pull/66 | відмови вендору: «Back to runs» на сторінках шаблонів, «Run not found» без тексту відмови | AC-VENDOR-07, 08, 14, 15 | усі треди: виправлено або аргумент | не застосовно (без міграцій) |
| https://github.com/yuriivynar/property-workflows/pull/67 | що бачить вендор: заголовок запуску, рядок списку, навігація | AC-VENDOR-11, 12, 13 | усі треди: виправлено або аргумент | не застосовно (без міграцій) |
| https://github.com/yuriivynar/property-workflows/pull/68 | прямі читання вендора — лише свої задачі | AC-VENDOR-17, 18 | усі треди: виправлено або аргумент | не застосовно (без міграцій) |
| https://github.com/yuriivynar/property-workflows/pull/70 | необов'язкова задача завершеного запуску, архів плану | AC-TASK-19, AC-VENDOR-16 | лише попередження «Тип PR і межі змін» (`scripts/mutants.mjs`) — аргумент | не застосовно |
| https://github.com/yuriivynar/property-workflows/pull/74 | UAT-докази: кадри й підказки | AC-TASK-19, AC-VENDOR-14, 16 | 2 треди: виправлено | не застосовно |

- Оновлення вигляду UI v2 (ADR 0008, палітра «Graphite & Teal», бічна панель, меню «Theme», вхід, хлібні крихти):
  #69 `f05a52f`, #71 `14fc7c0`, #72 `a5b16ac`, #73 `da32b1a`. Поведінка й тексти AC не змінювались. Усі знахідки
  CodeRabbit відповіджено: 2 у #71 і 2 у #73 виправлено, попередження про `DESIGN.md` — аргумент (AGENTS.md).
- Ворота на `main` (`CI`): https://github.com/yuriivynar/property-workflows/actions/runs/43060971774 (`41b1da5`)
- Мутації уточнення: TS-V14, TS-V15, V12, TS-V13, V18, V18P, T19 — 7 з 7 KILLED (вивід — в описах #66, #67, #68, #70)
- `docs/conformance.md`: 86 з 86 AC «реалізовано»

## C. UAT на проді

- Звіт: [uat/2026-11-11/report.md](uat/2026-11-11/report.md) і [manifest.json](uat/2026-11-11/manifest.json), кадри — у
  [uat/2026-11-11/frames/](uat/2026-11-11/frames/). 20 AC (3 AC-EDITOR, 16 AC-VENDOR, AC-TASK-19): PASS 20, FAIL 0,
  NEEDS-HUMAN 0.
- Відео й траси: не в git (`test-results/artifacts/…/video.webm`, `trace.zip`).
- Рецензент: `claude-haiku-5-5`, суперечки → `claude-sonnet-5-5`; вартість розбору $0.0881 (ціни API).
- Негативний контроль (`npm run uat:nc`, 11.11.2026; звіт і кадри — [uat/2026-11-11-nc/report.md](uat/2026-11-11-nc/report.md)):
  - NC-1 — навмисно хибне очікування в тесті: перевірка впала → FAIL (R1), хоча агент дав PASS;
  - NC-2 — «Тоді» у вимозі уточнено, а тест і застосунок ні: перевірки пройшли, агент не погодився (Haiku NEEDS-HUMAN, Sonnet FAIL) → NEEDS-HUMAN (R3).

  Жоден контроль не дає PASS. Позначка «+ незакомічені зміни» у звіті NC — це лише незакомічена тека звіту UAT
  `docs/qa/uat/2026-11-11/`; код і тести — `main @ 41b1da5`.
- Дані: `@writes` — синтетичні `uat-*@example.test` і запуски; прибирання зі звіту — видалено 34, лишилось 0.
- Історія прогонів 11.11.2026 (чесно):
  - Перший прогін на `main @ da32b1a`: 17 PASS і 3 NEEDS-HUMAN (R3, перевірки пройшли).
    - AC-VENDOR-16: кадр знято на `/runs`, тож задачі 3 «done» на ньому не видно.
    - AC-TASK-19: «Order a part» з AC немає в шаблоні проду.
    - AC-VENDOR-14: адресу `/runs` на кадрі не видно.
  - Це вади доказу, не продукту. Виправлено в специфікаціях (PR #74), застосунок не змінювався.
  - Другий, повний прогін — 20 з 20 PASS (звіт вище).

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-VENDOR-01…18, AC-TASK-19 | чекає приймання PM (повідомлення в чат команди — після злиття цього PR) | — |

## D. Прод і ретро

- `/api/health` після злиття всіх задач: sha `41b1da5`, db ok (11.11.2026)
- Акаунти: без змін — `vendor@example.test`, `pm-vendor@example.test` та інші з `supabase/demo-users.json`
- `docs/conformance.md`: https://github.com/yuriivynar/property-workflows/blob/41b1da585cc4e918b2010c4ad670bfe9e5769f0e/docs/conformance.md
- Ретро «що б ми взяли з фабрики у свій звичайний процес»: [retro-ws9.md](retro-ws9.md)
