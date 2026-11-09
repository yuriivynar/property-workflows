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
const VENDOR_ROLE = "supabase/migrations/20261102133035_vendor_role.sql";
const VENDOR_DB = "tests/db/vendor-work.test.ts";

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

  // ── Мутанти правил у SQL за AC зрізу 3 (WS9): вендор — виконавець, бачить і змінює лише своє ───────────────────
  // Кожен мутант послаблює правило до «дозволено» (а не видаляє політику: без політики RLS забороняє все, і тест
  // відмови лишився б зеленим). Усі живуть у міграції vendor_role; правила доводить tests/db/vendor-work.test.ts (PGlite).
  {
    id: "V02", kind: "sql", ac: "AC-VENDOR-02", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "staff_directory: у виборі виконавця немає вендорів (лише manager і admin)",
    find: "    and p.role in ('manager', 'admin', 'vendor')",
    replace: "    and p.role in ('manager', 'admin')",
  },
  {
    id: "V03", kind: "sql", ac: "AC-VENDOR-03", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "політика runs: вендор бачить рядки запусків напряму (мав би лише vendor_runs() зі своїми задачами)",
    find: "using (private.can_see_run(id) and (select private.current_app_role()) is distinct from 'vendor');",
    replace: "using (private.can_see_run(id));",
  },
  {
    id: "V04", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "can_see_run_task: вендор бачить усі задачі запуску, де має хоч одну, а не лише свої",
    find: "       or p_assignee_id = (select auth.uid())\n     );",
    replace: "       or true\n     );",
  },
  {
    id: "V06", kind: "sql", ac: "AC-VENDOR-06", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "vendor_run_tasks: задачі запуску повертаються не лише виконавцю — чужий запуск перестає бути «Run not found»",
    find: "    and t.assignee_id = (select auth.uid())\n    and (select private.current_app_role()) = 'vendor'",
    replace: "    and (select private.current_app_role()) = 'vendor'",
  },
  {
    id: "V07", kind: "sql", ac: "AC-VENDOR-07", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "mark_task_done: вендор може позначити будь-яку задачу, а не лише свою",
    find: "(v_role = 'manager' and v_run_manager_id = v_uid) or v_assignee_id = v_uid)",
    replace: "(v_role = 'manager' and v_run_manager_id = v_uid) or v_role = 'vendor')",
  },
  {
    id: "V08", kind: "sql", ac: "AC-VENDOR-08", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "політика templates: вендор бачить збережені шаблони нарівні з менеджером",
    find: "or ((select private.current_app_role()) = 'manager' and current_version is not null)",
    replace: "or ((select private.current_app_role()) in ('manager', 'vendor') and current_version is not null)",
  },
  {
    id: "V09", kind: "sql", ac: "AC-VENDOR-09", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "launch_run: вендор може запустити шаблон (LAUNCH_NOT_ALLOWED не спрацьовує)",
    find: "v_role is null or v_role not in ('manager', 'admin')",
    replace: "v_role is null or v_role not in ('manager', 'admin', 'vendor')",
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
