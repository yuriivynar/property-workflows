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
- Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-10
  (офлайн-реплей записаних відповідей: код навколо моделі), AC-DOCAI-09 (збої → стан «недоступний»); через
  сторінку ці AC перевіряє задача 2

## 2. Блок на сторінці запуску, підтвердження людиною, таблиця з RLS

- [x] 2.1 Міграція `run_document_values` з RLS (менеджер запуску й адміністратор), колонковий `grant insert`
- [x] 2.2 Server Actions `requestDocumentValues` (роль до моделі, нічого не пише) і `confirmDocumentValues` (роль, zod,
  правила коду, `insert` під RLS)
- [x] 2.3 `document-parsing-form.tsx` і розділ «Document values» на сторінці запуску; `Textarea` з shadcn
- [x] 2.4 Тести: бази (хто читає й пише, вендор — нічого), дій (без ролі моделі не кличе, без «Save values» нічого не
  записано), компонента (стани відмови й «недоступний»)
- Done when: AC-DOCAI-08, AC-DOCAI-09; AC-DOCAI-02, AC-DOCAI-06, AC-DOCAI-07 — у формі на сторінці запуску (тест
  компонента), решта AC-DOCAI-01…07, AC-DOCAI-10 — той самий шлях від тексту до форми

## 3. Живий eval і записи

- [x] 3.1 `npm run eval` з `RECORD=1` (розробник, у своєму терміналі); `recorded.json` без заглушок; старший запис —
  лише з причиною (`OLDER_RECORDS`)
- [x] 3.2 Звіт `evals/reports/<дата й час>.md`, пояснення кожного FAIL, порівняння з порогом (Q18 solomchaak/property-workflows-spec#55, варіант A); суддя з
  версією, дорозбір `CASES`
- Done when: AC-DOCAI-01…07, AC-DOCAI-10 — реплей справжніх відповідей у CI

## 4. Прод, UAT, conformance

- [ ] 4.1 Прод: `/api/health` з SHA `main`, ключ у Vercel Production
- [ ] 4.2 UAT на проді: AC-DOCAI-08 і AC-DOCAI-07 → `docs/qa/uat/<дата>/`
- [ ] 4.3 `docs/conformance.md` на кожен AC; archive `impl-document-parsing`
- Done when: AC-DOCAI-07, AC-DOCAI-08 (UAT на проді)
