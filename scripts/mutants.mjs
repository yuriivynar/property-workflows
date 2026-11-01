// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests); там 11 SQL- і 2 TS-мутанти.
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним (рядок міграції, інший тест). Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// P1 і P2 з матеріалів (перевірка гарнесу на profiles-db.test.ts) не беремо: у нас свій PGlite-гарнес з WS6
// (tests/db/supabase-pglite.ts), і його доводять мутанти наших AC нижче.
const RUNS = "supabase/migrations/20261020115705_workflow_runs.sql";
const VERSIONS = "supabase/migrations/20261026133459_template_versions.sql";
const EDITOR_DB = "tests/db/template-editor.test.ts";
const CLARIFY_DB = "tests/db/template-clarify.test.ts";

export const mutants = [
  // ── Мутанти правил у SQL за нашими 3 AC (WS8) ──────────────────────────────────────────────────────────────────
  {
    id: "E07", kind: "sql", ac: "AC-EDITOR-07", file: VERSIONS, tests: [EDITOR_DB],
    what: "політика template_versions: менеджер бачить усі версії збереженого шаблону, а не лише поточну",
    find: "where t.id = template_versions.template_id and t.current_version = template_versions.number",
    replace: "where t.id = template_versions.template_id",
  },
  {
    id: "E09", kind: "sql", ac: "AC-EDITOR-09", file: RUNS, tests: [EDITOR_DB],
    what: "відвідувач без входу (anon) отримує select на шаблони, розділи й задачі",
    find: "  public.runs, public.run_sections, public.run_tasks\n  to authenticated;",
    replace: "  public.runs, public.run_sections, public.run_tasks\n  to anon, authenticated;",
  },
  {
    id: "E19", kind: "sql", ac: "AC-EDITOR-19", file: VERSIONS, tests: [CLARIFY_DB],
    what: "обмеження назви шаблону без btrim: назва лише з пробілів проходить базу",
    find: "add constraint templates_name_not_blank check (char_length(btrim(name)) > 0);",
    replace: "add constraint templates_name_not_blank check (char_length(name) > 0);",
  },
];

// Приклади з демо (інша схема — у вашому репо цих файлів немає, тож не розкоментовуйте як є):
//
// SQL, межа з AC — діапазон напіввідкритий, останній день заявки не рахується:
//   { id: "L2", kind: "sql", ac: "AC-LEAVE-11", file: RULES, tests: [LEAVE_DB],
//     what: "перетин: діапазон НОВОЇ заявки напіввідкритий [початок, кінець)",
//     find: "pg_catalog.daterange(p_start_date, p_end_date, '[]')",
//     replace: "pg_catalog.daterange(p_start_date, p_end_date, '[)')" },
//
// SQL, політика послаблена до true (а не видалена: без політики RLS забороняє все, і тест відмови лишився б зеленим):
//   { id: "L5", kind: "sql", ac: "передумова AC-LEAVE-04/10", file: LEAVE, tests: [LEAVE_DB],
//     what: "blocked_days: insert дозволено будь-кому з входом, а не лише адміністратору",
//     find: "on public.blocked_days for insert to authenticated\n  with check ((select private.current_app_role()) = 'admin');",
//     replace: "on public.blocked_days for insert to authenticated\n  with check (true);" },
//
// Еквівалентний мутант — лише з reason, що посилається на рядок, який робить його зайвим:
//   { id: "L6", kind: "sql", ac: "AC-LEAVE-06/07", file: RECORDS, tests: [LEAVE_DB],
//     what: "політика рішень: прибрано role = 'manager'", expect: "survive",
//     reason: "еквівалентний: з 20261018000000_manager_helpers_require_role.sql private.is_division_manager() сама " +
//       "перевіряє current_app_role() = 'manager'", find: "…", replace: "…" },
//
// TS, точковий мутант на межі з AC (повний перебір TS — npm run mutation:ts, Stryker):
//   { id: "T1", kind: "ts", ac: "AC-LEAVE-11", file: "src/lib/leave/calendar.ts", tests: ["tests/leave/calendar.test.ts"],
//     what: "rangesOverlap: <= → <", find: "b.startDate <= a.endDate", replace: "b.startDate < a.endDate" },
