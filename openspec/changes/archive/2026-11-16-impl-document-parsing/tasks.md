# Задачі: AI-розбір документа в запуску (зріз 4)

## 1. AI-ядро: набір, ключ на сервері, схема, промпт, правила коду, офлайн golden cases

- [x] 1.1 ADR `docs/decisions/0009-ai-feature-openrouter.md`; залежності `ai@7.0.162`, `@openrouter/ai-sdk-provider@3.1.0`,
  `zod@4.6.7`, `server-only@0.0.1` (`--save-exact`); скрипти `eval`, `ai:models`, `ai:quota`; `OPENROUTER_API_KEY=` у
  `.env.example`
- [x] 1.2 `src/lib/ai/` з набору під домен: схема, промпт з межею `<document>`, обгортка з ключем лише в `openrouter.ts`,
  ланцюжок `:free`, класифікація збоїв
- [x] 1.3 `src/lib/documents/values.ts`: телефон, сума кошторису й попередження, тексти відмови й приміток, пошук
  інструкцій для AI у тексті, стан «недоступний»
- [x] 1.4 `tests/fixtures/golden/cases.json` з #40; `tests/golden.test.ts` (реплей, збої, ін'єкція); `tests/ai-key.test.ts`
- Done when: AC-DOCAI-01, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-02, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10
  (офлайн-реплей записаних відповідей: код навколо моделі), AC-DOCAI-13 (збої → стан «недоступний»); через
  сторінку ці AC перевіряє задача 2

## 2. Блок на сторінці запуску, підтвердження людиною, таблиця з RLS

- [x] 2.1 Міграція `run_document_values` з RLS (менеджер запуску й адміністратор), колонковий `grant insert`
- [x] 2.2 Server Actions `requestDocumentValues` (роль до моделі, нічого не пише) і `confirmDocumentValues` (роль, zod,
  правила коду, `insert` під RLS)
- [x] 2.3 `document-parsing-form.tsx` і розділ «Document values» на сторінці запуску; `Textarea` з shadcn
- [x] 2.4 Тести: бази (хто читає й пише, вендор — нічого), дій (без ролі моделі не кличе, без «Save values» нічого не
  записано), компонента (стани відмови й «недоступний»)
- Done when: AC-DOCAI-04, AC-DOCAI-13; AC-DOCAI-06, AC-DOCAI-08, AC-DOCAI-09 — у формі на сторінці запуску (тест
  компонента), решта AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06…AC-DOCAI-10 — той самий шлях від тексту до форми

## 3. Живий eval і записи

- [x] 3.1 `npm run eval` з `RECORD=1` (розробник, у своєму терміналі); `recorded.json` без заглушок; старший запис —
  лише з причиною (`OLDER_RECORDS`)
- [x] 3.2 Звіт `evals/reports/<дата й час>.md`, пояснення кожного FAIL, порівняння з порогом (Q18 solomchaak/property-workflows-spec#55, варіант A); суддя з
  версією, дорозбір `CASES`
- Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06…AC-DOCAI-10 — реплей справжніх відповідей у CI

## 5. Критерії PM (вимога solomchaak/property-workflows-spec#59): нова поведінка блоку й ID тестів

Тимчасові AC-DOCAI-01…10 замінено критеріями PM AC-DOCAI-01…16 (зміна clarify-document-parsing): задачі 1–3 вище
написано під тимчасові ID, їхні тести перейменовуємо за відповідністю з proposal.md тієї зміни.

- [x] 5.1 Кнопка «Propose values» замість «Parse document»; під час розбору — «Reading the document…» (AC-DOCAI-03)
- [x] 5.2 «Discard»: блок знову порожній, нічого не збережено (AC-DOCAI-05)
- [x] 5.3 «Upload a text file»: файл .txt читається в текстове поле; інший файл — «Only plain text files (.txt) are
  accepted» (AC-DOCAI-12)
- [x] 5.4 Час підтвердження в записі — як у «Припущеннях» PM: «12 Nov 2026, 10:15» за Києвом (AC-DOCAI-04)
- [x] 5.5 Тест компонента RunDocuments: вендор і менеджер, що не є менеджером запуску, не бачать блоку (AC-DOCAI-14,
  AC-DOCAI-15); прямі запити — тести сервісу й бази (AC-DOCAI-16)
- [x] 5.6 Назви тестів, `ac` у `tests/fixtures/golden/cases.json` і UAT — під ID PM
- Done when: AC-DOCAI-01…16

## 4. Прод, UAT, conformance

- [x] 4.1 Прод: `/api/health` з SHA `main`, ключ у Vercel Production
- [x] 4.2 UAT на проді: AC-DOCAI-04 і AC-DOCAI-09 (критерії PM) → `docs/qa/uat/<дата>/`
- [x] 4.3 `docs/conformance.md` на кожен AC; archive `impl-document-parsing`
- Done when: AC-DOCAI-04, AC-DOCAI-09 (UAT на проді)
