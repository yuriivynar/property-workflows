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
const WS7_RULES = "supabase/migrations/20261115134842_ws7_review_template_rules.sql";
const RULES_DB = "tests/db/template-rules-review.test.ts";
const DOC_VALUES = "supabase/migrations/20261116092131_run_document_values.sql";
const DOC_VALUES_DB = "tests/db/document-values.test.ts";
const AI_LIMITS = "supabase/migrations/20261117092135_ai_requests_limits_and_profile_email_sync.sql";
const AI_LIMITS_DB = "tests/db/ai-requests.test.ts";

export const mutants = [
  // ── Мутанти правил у SQL за нашими 3 AC (WS8) ──────────────────────────────────────────────────────────────────
  {
    // Політику template_versions видаляє й створює наново vendor_role.sql: мутуємо останнє визначення, бо мутант
    // старої міграції повний прогін показав би SURVIVED (діє вже нова політика).
    id: "E07", kind: "sql", ac: "AC-EDITOR-07", file: VENDOR_ROLE, tests: [EDITOR_DB],
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
    // Обмеження перевизначено в 20261115134842 (clean_name замість btrim, рев'ю WS7 №4): мутуємо чинне визначення.
    id: "E19", kind: "sql", ac: "AC-EDITOR-19", file: WS7_RULES, tests: [CLARIFY_DB, RULES_DB],
    what: "обмеження назви шаблону без clean_name: назва лише з пробільних символів проходить базу",
    find: "add constraint templates_name_not_blank check (char_length(private.clean_name(name)) > 0);",
    replace: "add constraint templates_name_not_blank check (char_length(name) > 0);",
  },

  // ── Відмовні AC зрізу 2 без мутанта (рев'ю WS7 №3): «AC → що прибрали → який тест упав» ──────────────────────
  {
    id: "E11", kind: "sql", ac: "AC-EDITOR-11", file: VENDOR_ROLE, tests: [CLARIFY_DB],
    what: "launch_run: шаблон без збереженої версії не відхиляється як TEMPLATE_NOT_FOUND (лише «не знайдено»)",
    find: "  if not found or v_version is null then",
    replace: "  if not found then",
  },
  {
    id: "E16", kind: "sql", ac: "AC-EDITOR-16", file: VENDOR_ROLE, tests: [CLARIFY_DB],
    what: "політика templates: менеджер бачить і незбережений шаблон (без умови current_version is not null)",
    find: "or ((select private.current_app_role()) = 'manager' and current_version is not null)",
    replace: "or (select private.current_app_role()) = 'manager'",
  },
  {
    id: "E29", kind: "sql", ac: "AC-EDITOR-29", file: VERSIONS, tests: [CLARIFY_DB],
    what: "політика template_tasks: незбережені задачі шаблону читає будь-хто, а не лише адміністратор",
    find: "create policy template_tasks_select_admin\n  on public.template_tasks for select to authenticated\n  using ((select private.current_app_role()) = 'admin');",
    replace: "create policy template_tasks_select_admin\n  on public.template_tasks for select to authenticated\n  using (true);",
  },
  {
    id: "TS-E26", kind: "ts", ac: "AC-EDITOR-26", file: "src/app/templates/actions.ts", tests: ["src/app/templates/actions.test.ts"],
    what: "adminClient: відвідувача без входу ведемо не на /login, а на сторінку з «Not enough rights»",
    find: 'check.reason === "NOT_SIGNED_IN" ? "/login" : `${back}?error=NOT_ALLOWED`',
    replace: "`${back}?error=NOT_ALLOWED`",
  },
  {
    id: "TS-T16", kind: "ts", ac: "AC-TASK-16", file: "src/app/runs/[id]/mark-done-button.tsx",
    tests: ["src/app/runs/[id]/mark-done-button.test.tsx"],
    what: "MarkDoneButton: Cancel на підтвердженні не повертає кнопку «Mark as done» — підтвердження лишається відкритим",
    find: "onClick={() => setConfirming(false)}",
    replace: "onClick={() => setConfirming(true)}",
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

  // ── Уточнення зрізу 3 (10.11, impl-clarify-vendor-work): відмови вендору на сторінках ───────────────────────────
  // Правило «що бачить вендор на відмові» живе в чистих функціях (сторінки лише рендерять їх результат); мутант
  // послаблює правило, юніт-тест має впасти. Відмову позначки в базі для AC-VENDOR-15 доводить наявний V07.
  {
    id: "TS-V14", kind: "ts", ac: "AC-VENDOR-14", file: "src/lib/templates/domain.ts", tests: ["src/lib/templates/domain.test.ts"],
    what: "refusalBackLink: вендору на відмові — «Back to templates» (веде на ще одну відмову) замість «Back to runs»",
    find: 'return role === "vendor"',
    replace: 'return role === "nobody"',
  },
  {
    id: "TS-V15", kind: "ts", ac: "AC-VENDOR-15", file: "src/lib/runs/domain.ts", tests: ["src/lib/runs/domain.test.ts"],
    what: "vendorRunNotice: текст відмови позначки й на запуску без задач вендора — сторінка підказує, що запуск існує",
    find: "if (!runFound || !errorCode) return undefined;",
    replace: "if (!errorCode) return undefined;",
  },
  // ── Уточнення зрізу 3 (10.11): що бачить вендор — заголовок запуску, рядок списку, навігація ───────────────────
  {
    id: "V12", kind: "sql", ac: "AC-VENDOR-12", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "vendor_runs: до назви випадку дописано назву шаблону — вендор бачить «Tenant move-in» у рядку списку й заголовку",
    find: "  select r.id, r.case_name, r.status, r.created_at,",
    replace: "  select r.id, r.case_name || ' · ' || r.template_name, r.status, r.created_at,",
  },
  {
    id: "TS-V13", kind: "ts", ac: "AC-VENDOR-13", file: "src/lib/auth/nav.ts", tests: ["src/lib/auth/nav.test.ts"],
    what: "navItems: вендору показано й «Templates» (посилання на сторінку, що завжди відмовляє)",
    find: 'role === "vendor" ? []',
    replace: 'role === "nobody" ? []',
  },
  // ── Уточнення зрізу 3 (10.11): прямі читання вендора (AC-VENDOR-17 доводять ще й наявні V04 і V06) ────────────────
  {
    id: "V18", kind: "sql", ac: "AC-VENDOR-18", file: VENDOR_ROLE, tests: [VENDOR_DB],
    what: "staff_directory: довідник колег (id, email) віддає і вендору",
    find: "  where (select private.current_app_role()) in ('manager', 'admin')\n    and p.role in ('manager', 'admin', 'vendor')",
    replace: "  where (select private.current_app_role()) in ('manager', 'admin', 'vendor')\n    and p.role in ('manager', 'admin', 'vendor')",
  },
  {
    id: "V18P", kind: "sql", ac: "AC-VENDOR-18", file: "supabase/migrations/20261012000000_profiles_and_roles.sql", tests: [VENDOR_DB],
    what: "політика profiles: вендор читає профілі всіх користувачів (email, роль), як адміністратор",
    find: "    or (select private.current_app_role()) = 'admin'\n  );",
    replace: "    or (select private.current_app_role()) in ('admin', 'vendor')\n  );",
  },
  // ── Уточнення 10.11: необов'язкова задача завершеного запуску (AC-TASK-19, AC-VENDOR-16) ──────────────────────────
  {
    id: "T19", kind: "sql", ac: "AC-TASK-19", file: VENDOR_ROLE, tests: [VENDOR_DB, "tests/db/run-progress.test.ts"],
    what: "mark_task_done: у запуску «completed» позначку відхилено — необов'язкову задачу вже не позначити",
    find: "  if v_status = 'done' then\n    return;\n  end if;",
    replace: "  if v_status = 'done' then\n    return;\n  end if;\n  if exists (select 1 from public.runs where id = v_run_id and status = 'completed') then\n    raise exception 'RUN_COMPLETED' using errcode = '22023';\n  end if;",
  },
  // ── Правила шаблонів за рев'ю WS7 (міграція 20261115134842) ─────────────────────────────────────────────────────
  {
    id: "U29", kind: "sql", ac: "AC-EDITOR-29", file: WS7_RULES, tests: [RULES_DB],
    what: "templates_with_unpublished_changes(): без перевірки ролі — менеджер дізнається про незбережені зміни",
    find: "  where (select private.current_app_role()) = 'admin' and t.has_unpublished_changes;",
    replace: "  where t.has_unpublished_changes;",
  },
  {
    id: "U29G", kind: "sql", ac: "AC-EDITOR-29", file: WS7_RULES, tests: [RULES_DB],
    what: "grant select на всю таблицю templates — менеджер читає has_unpublished_changes прямим запитом",
    find: "grant select (id, name, created_at, current_version) on table public.templates to authenticated;",
    replace: "grant select on table public.templates to authenticated;",
  },
  {
    id: "N23", kind: "sql", ac: "AC-EDITOR-23", file: WS7_RULES, tests: [RULES_DB],
    what: "унікальність назви за btrim, а не clean_name: «Tenant move-in» з табуляцією — дублікат",
    find: "create unique index templates_name_normalized_key on public.templates (lower(private.clean_name(name)));",
    replace: "create unique index templates_name_normalized_key on public.templates (lower(btrim(name)));",
  },
  {
    id: "P08", kind: "sql", ac: "—", file: WS7_RULES, tests: [RULES_DB],
    what: "немає унікальності (section_id, position): дві задачі розділу з однаковою позицією",
    find: "add constraint template_tasks_section_position_key unique (section_id, position) deferrable initially deferred;",
    replace: "add constraint template_tasks_section_position_key check (position > 0);",
  },

  // ── Зріз 4: підтверджені значення документа (AC-DOCAI-08, тимчасовий AC) ───────────────────────────────────────
  {
    id: "D08a", kind: "sql", ac: "AC-DOCAI-08", file: DOC_VALUES, tests: [DOC_VALUES_DB],
    what: "can_manage_run_documents: виконавець задачі запуску (зокрема вендор) — теж «менеджер» значень документа",
    find: "          and r.run_manager_id = (select auth.uid())\n",
    replace:
      "          and r.run_manager_id = (select auth.uid())\n" +
      "        )\n        or (\n          exists (select 1 from public.run_tasks as t where t.run_id = r.id and t.assignee_id = (select auth.uid()))\n",
  },
  {
    id: "D08b", kind: "sql", ac: "AC-DOCAI-08", file: DOC_VALUES, tests: [DOC_VALUES_DB],
    what: "колонковий grant insert включає confirmed_by: користувач підписує запис іменем іншого",
    find: "grant insert (run_id, kind, fields) on table public.run_document_values to authenticated;",
    replace: "grant insert (run_id, kind, fields, confirmed_by) on table public.run_document_values to authenticated;",
  },

  // ── Рев'ю безпеки 2026-11-17: ліміт запитів до моделі, розмір значень, синхронізація email ─────────────────────
  {
    id: "Q13a", kind: "sql", ac: "AC-DOCAI-13", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "take_ai_request: годинна межа користувача зсунута на один — одинадцятий запит ще проходить",
    find: ") >= c_user_per_hour then",
    replace: ") > c_user_per_hour then",
  },
  {
    id: "Q13b", kind: "sql", ac: "AC-DOCAI-13", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "take_ai_request: добова межа застосунку зсунута на один — сорок перший запит ще проходить",
    find: ") >= c_app_per_day then",
    replace: ") > c_app_per_day then",
  },
  {
    id: "Q13c", kind: "sql", ac: "AC-DOCAI-16", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "take_ai_request: роль не перевіряється — вендор теж бере запити до моделі",
    find: "if v_user is null or v_role is null or v_role not in ('manager', 'admin') then",
    replace: "if v_user is null then",
  },
  {
    id: "Q13d", kind: "sql", ac: "AC-DOCAI-13", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "take_ai_request: годинний ліміт рахує запити всіх, а не лише викликача — один користувач блокує інших",
    find: "where user_id = v_user and created_at > now() - interval '1 hour'",
    replace: "where created_at > now() - interval '1 hour'",
  },
  {
    id: "Q13e", kind: "sql", ac: "AC-DOCAI-13", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "ai_requests: authenticated отримує select на таблицю обліку — клієнт бачить чужі запити",
    find: "grant select, insert, update, delete on table public.ai_requests to service_role;",
    replace: "grant select, insert, update, delete on table public.ai_requests to service_role;\ngrant select on table public.ai_requests to authenticated;",
  },
  {
    id: "S05", kind: "sql", ac: "—", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "run_document_values.fields: межа розміру зсунута з 32 КБ до 3 МБ — довільно великий jsonb проходить",
    find: "pg_catalog.pg_column_size(fields) < 32768",
    replace: "pg_catalog.pg_column_size(fields) < 3276800",
  },
  {
    id: "S08a", kind: "sql", ac: "—", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "sync_profile_email: оновлення без where id = new.id — зміна email одного користувача переписує всі профілі",
    find: "   where id = new.id\n     and email is distinct from new.email;",
    replace: "   where email is distinct from new.email;",
  },
  {
    id: "S08b", kind: "sql", ac: "—", file: AI_LIMITS, tests: [AI_LIMITS_DB],
    what: "on_auth_user_email_changed: тригер слухає не колонку email — зміна email у Auth не доходить до профілю",
    find: "after update of email on auth.users",
    replace: "after update of raw_user_meta_data on auth.users",
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
