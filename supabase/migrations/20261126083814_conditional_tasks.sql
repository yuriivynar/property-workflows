-- Задача лише для певної відповіді (зріз 5: openspec/specs/conditional-tasks, MODIFIED «Прогрес запуску» і «Завершення
-- запуску» в openspec/specs/run-progress; план — openspec/changes/impl-conditional-tasks/design.md; вимога PM
-- solomchaak/property-workflows-spec#51, AC-LOGIC-01…05).
--
-- 1) Шаблон: поле-вибір (template_fields) і умова «показати, коли поле = відповідь» на задачі шаблону; знімок версії
--    (ADR 0002) несе поля й умови. Редактора полів немає (Non-goals): лише початкові дані міграцій.
-- 2) Запуск: копія поля з відповіддю (run_fields), копія умови й is_shown на задачі запуску. is_shown пишуть лише
--    launch_run і set_run_field_answer (у authenticated немає update на run_tasks).
-- 3) Прогрес, завершення, вендор — лише показані задачі (run_overview, mark_task_done, vendor_runs, vendor_run_tasks, RLS).
-- 4) set_run_field_answer — атомарно: роль → відповідь → залежні задачі «to do» → статус запуску.
-- 5) Початкові дані: шаблон «Repair» з полем «Urgency» (AC-LOGIC-01) — новий шаблон, наявні запуски не змінюються.

-- ── 1. Поля й умови шаблону ─────────────────────────────────────────────────
create table public.template_fields (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) > 0),
  -- Тип поля — лише «choice» (Non-goals): фіксовані відповіді, щонайменше дві.
  options     text[] not null check (cardinality(options) >= 2),
  position    integer not null,
  constraint template_fields_name_key unique (template_id, name),
  constraint template_fields_position_key unique (template_id, position)
);

create index template_fields_template_id_idx on public.template_fields (template_id);

comment on table public.template_fields is
  'Поле-вибір шаблону (AC-LOGIC-01). Готується як початкові дані міграцією; редактора немає (Non-goals #51).';

alter table public.template_tasks
  add column show_when_field_id uuid references public.template_fields (id) on delete set null,
  add column show_when_value text,
  add constraint template_tasks_show_when_check check ((show_when_field_id is null) = (show_when_value is null));

alter table public.template_fields enable row level security;
revoke all on table public.template_fields from anon, authenticated;
grant select on table public.template_fields to authenticated;
grant select, insert, update, delete on table public.template_fields to service_role;

-- Як template_tasks: читає лише адміністратор (менеджер бачить шаблон через знімок версії, вендор — нічого).
create policy template_fields_select_admin
  on public.template_fields for select to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Знімок версії: + fields і show_when задачі (лише коли задано). Старі версії без fields запускаються як раніше.
create or replace function private.template_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sections',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'position', s.position,
            'tasks', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', tt.id, 'name', tt.name, 'is_required', tt.is_required, 'position', tt.position)
                  || case
                       when tt.show_when_field_id is null then '{}'::jsonb
                       else jsonb_build_object(
                         'show_when', jsonb_build_object('field_id', tt.show_when_field_id, 'value', tt.show_when_value)
                       )
                     end
                  order by tt.position
                ),
                '[]'::jsonb
              )
              from public.template_tasks as tt
              where tt.section_id = s.id
            )
          )
          order by s.position
        )
        from public.template_sections as s
        where s.template_id = p_template_id
      ),
      '[]'::jsonb
    ),
    'fields',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', f.id, 'name', f.name, 'options', to_jsonb(f.options), 'position', f.position)
          order by f.position
        )
        from public.template_fields as f
        where f.template_id = p_template_id
      ),
      '[]'::jsonb
    )
  );
$$;

-- ── 2. Поля й умови запуску ─────────────────────────────────────────────────
create table public.run_fields (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references public.runs (id) on delete cascade,
  name     text not null,
  options  text[] not null,
  position integer not null,
  -- Відповідь — як у тексті PM (`urgent` / `not urgent`); null — без відповіді (AC-LOGIC-01).
  answer   text,
  constraint run_fields_answer_check check (answer is null or answer = any (options)),
  constraint run_fields_position_key unique (run_id, position)
);

create index run_fields_run_id_idx on public.run_fields (run_id);

comment on table public.run_fields is
  'Поле запуску з відповіддю — копія поля версії на момент запуску. Змінює лише set_run_field_answer (AC-LOGIC-02…05).';

alter table public.run_tasks
  add column show_when_field_id uuid references public.run_fields (id) on delete cascade,
  add column show_when_value text,
  add column is_shown boolean not null default true,
  add constraint run_tasks_show_when_check check ((show_when_field_id is null) = (show_when_value is null));

create index run_tasks_show_when_field_id_idx on public.run_tasks (show_when_field_id);

comment on column public.run_tasks.is_shown is
  'Чи показано задачу за відповіддю її поля (AC-LOGIC-01, -02). Пишуть лише launch_run і set_run_field_answer.';

alter table public.run_fields enable row level security;
revoke all on table public.run_fields from anon, authenticated;
grant select on table public.run_fields to authenticated;
grant select, insert, update, delete on table public.run_fields to service_role;

-- Поле й відповідь бачать ті, хто бачить запуск, крім вендора («does not see the question», #51).
create policy run_fields_select_visible
  on public.run_fields for select to authenticated
  using (private.can_see_run(run_id) and (select private.current_app_role()) is distinct from 'vendor');

-- ── 3. Лише показані задачі: RLS вендора, прогрес, завершення ────────────────
-- Вендор бачить лише свої показані задачі й розділи з ними; менеджер і адміністратор — і приховані (рядок-«привид»).
drop policy run_tasks_select_visible on public.run_tasks;

create policy run_tasks_select_visible
  on public.run_tasks for select to authenticated
  using (
    private.can_see_run_task(run_id, assignee_id)
    and (is_shown or (select private.current_app_role()) is distinct from 'vendor')
  );

create or replace function private.can_see_run_section(p_run_id uuid, p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_see_run(p_run_id)
     and (
       (select private.current_app_role()) is distinct from 'vendor'
       or exists (
         select 1 from public.run_tasks as t
         where t.section_id = p_section_id and t.assignee_id = (select auth.uid()) and t.is_shown
       )
     );
$$;

-- «N of M done» — лише показані задачі (MODIFIED «Прогрес запуску»; AC-LOGIC-01, -02).
create or replace view public.run_overview
with (security_invoker = true)
as
select
  r.id,
  r.case_name,
  r.template_name,
  r.status,
  r.run_manager_id,
  r.created_at,
  (count(t.id) filter (where t.status = 'done' and t.is_shown))::integer as done_count,
  (count(t.id) filter (where t.is_shown))::integer as total_count
from public.runs as r
left join public.run_tasks as t on t.run_id = r.id
group by r.id;

create or replace function private.vendor_runs()
returns table (id uuid, case_name text, status text, created_at timestamptz, my_done integer, my_total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.case_name, r.status, r.created_at,
         (count(*) filter (where t.status = 'done'))::integer,
         count(*)::integer
  from public.runs as r
  join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid()) and t.is_shown
  where (select private.current_app_role()) = 'vendor'
  group by r.id
  order by r.created_at desc;
$$;

create or replace function private.vendor_run_tasks(p_run_id uuid)
returns table (
  id uuid, name text, is_required boolean, status text, task_position integer,
  section_name text, section_position integer, needs_confirmation boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.is_required, t.status, t.position, s.name, s.position,
         (t.is_required and t.status <> 'done' and not exists (
           select 1 from public.run_tasks as o
           where o.run_id = t.run_id and o.is_shown and o.is_required and o.status <> 'done' and o.id <> t.id
         ))
  from public.run_tasks as t
  join public.run_sections as s on s.id = t.section_id
  where t.run_id = p_run_id
    and t.is_shown
    and t.assignee_id = (select auth.uid())
    and (select private.current_app_role()) = 'vendor'
  order by s.position, t.position;
$$;

-- Позначка: прихована задача — відмова; «остання обов'язкова» і завершення — серед показаних (AC-LOGIC-03).
create or replace function private.mark_task_done(p_task_id uuid, p_confirmed boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_role           text := coalesce((select private.current_app_role()), '');
  v_run_id         uuid;
  v_run_manager_id uuid;
  v_assignee_id    uuid;
  v_status         text;
  v_is_required    boolean;
  v_is_shown       boolean;
begin
  select t.run_id, r.run_manager_id, t.assignee_id
    into v_run_id, v_run_manager_id, v_assignee_id
  from public.run_tasks as t
  join public.runs as r on r.id = t.run_id
  where t.id = p_task_id;

  if not found or v_uid is null
     or not (v_role = 'admin' or (v_role = 'manager' and v_run_manager_id = v_uid) or v_assignee_id = v_uid) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  -- Позначки й відповіді одного запуску — по черзі; стан нижче читаємо вже після блокування.
  perform 1 from public.runs where id = v_run_id for update;

  select t.status, t.is_required, t.is_shown into v_status, v_is_required, v_is_shown
  from public.run_tasks as t where t.id = p_task_id;

  if not v_is_shown then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  if v_status = 'done' then
    return;
  end if;

  -- Остання показана обов'язкова задача «to do» завершить запуск — лише з підтвердженням.
  if v_is_required and not coalesce(p_confirmed, false) and not exists (
    select 1 from public.run_tasks
    where run_id = v_run_id and is_shown and is_required and status <> 'done' and id <> p_task_id
  ) then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = '22023';
  end if;

  update public.run_tasks set status = 'done' where id = p_task_id;

  if not exists (
    select 1 from public.run_tasks
    where run_id = v_run_id and is_shown and is_required and status <> 'done'
  ) then
    update public.runs set status = 'completed' where id = v_run_id and status <> 'completed';
  end if;
end;
$$;

-- Запуск: + копія полів (без відповіді) і умов; задача з умовою прихована, доки немає відповіді (AC-LOGIC-01).
-- Тіло — з 20261102133035_vendor_role.sql; додано лише блок «Поля й умови».
create or replace function private.launch_run(
  p_template_id      uuid,
  p_case_name        text,
  p_assignments      jsonb default '{}'::jsonb,
  p_expected_version integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := (select auth.uid());
  v_role          text := (select private.current_app_role());
  -- Пробільні символи на краях обрізаємо — той самий набір, що й trim() у формі
  -- (робоче рішення solomchaak/property-workflows-spec#6).
  v_case_name     text := regexp_replace(coalesce(p_case_name, ''), '^[\s   -     　﻿]+|[\s   -     　﻿]+$', '', 'g');
  v_assignments   jsonb := coalesce(p_assignments, '{}'::jsonb);
  v_template_name text;
  v_version       integer;
  v_content       jsonb;
  v_run_id        uuid;
begin
  if v_uid is null or v_role is null or v_role not in ('manager', 'admin') then
    raise exception 'LAUNCH_NOT_ALLOWED' using errcode = '42501';
  end if;

  if v_case_name = '' then
    raise exception 'CASE_NAME_REQUIRED' using errcode = '22023';            -- AC-RUN-03
  end if;

  if char_length(v_case_name) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = '22023';            -- AC-RUN-07
  end if;

  -- Шаблон без жодної збереженої версії не запускається (робоче рішення до solomchaak/property-workflows-spec#21).
  select t.name, t.current_version into v_template_name, v_version
  from public.templates as t where t.id = p_template_id;
  if not found or v_version is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_expected_version is not null and p_expected_version <> v_version then
    raise exception 'TEMPLATE_VERSION_CHANGED' using errcode = '22023';
  end if;

  select v.content into v_content
  from public.template_versions as v
  where v.template_id = p_template_id and v.number = v_version;

  if jsonb_typeof(v_assignments) <> 'object' then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_object_keys(v_assignments))
     <> (select count(distinct lower(k)) from jsonb_object_keys(v_assignments) as k) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  -- Виконавець задачі поточної версії — менеджер, адміністратор або вендор (AC-VENDOR-01); менеджер запуску — лише той,
  -- хто запустив, а запускають лише менеджер і адміністратор (перевірка ролі вище; AC-VENDOR-09).
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, assignee_id)
    join (
      select task ->> 'id' as id
      from jsonb_array_elements(v_content -> 'sections') as section,
           jsonb_array_elements(section -> 'tasks') as task
    ) as vt on vt.id = lower(a.task_id)
    left join public.profiles as p on p.id::text = lower(a.assignee_id) and p.role in ('manager', 'admin', 'vendor')
    where p.id is null
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  -- Рівно один запуск «in progress» з номером версії; менеджер запуску — той, хто запустив (AC-RUN-01, AC-EDITOR-06).
  insert into public.runs (template_id, template_name, template_version, case_name, run_manager_id)
  values (p_template_id, v_template_name, v_version, v_case_name, v_uid)
  returning id into v_run_id;

  -- Копія розділів і задач поточної версії (AC-RUN-02, AC-RUN-12); усі задачі «to do» (AC-RUN-01).
  insert into public.run_sections (run_id, name, position)
  select v_run_id, section ->> 'name', (section ->> 'position')::integer
  from jsonb_array_elements(v_content -> 'sections') as section;

  -- Поля й умови: копія поля без відповіді (AC-LOGIC-01); старі версії без fields — без полів.
  insert into public.run_fields (run_id, name, options, position)
  select v_run_id, field ->> 'name',
         array(select jsonb_array_elements_text(field -> 'options')),
         (field ->> 'position')::integer
  from jsonb_array_elements(coalesce(v_content -> 'fields', '[]'::jsonb)) as field;

  insert into public.run_tasks (
    run_id, section_id, name, is_required, position, assignee_id, show_when_field_id, show_when_value, is_shown
  )
  select v_run_id, rs.id, task ->> 'name', (task ->> 'is_required')::boolean, (task ->> 'position')::integer,
         coalesce(p.id, v_uid),
         rf.id,
         case when rf.id is null then null else task -> 'show_when' ->> 'value' end,
         -- Поле без відповіді не відповідає жодній умові — задача з умовою прихована (Припущення #51).
         rf.id is null
  from jsonb_array_elements(v_content -> 'sections') as section
  cross join jsonb_array_elements(section -> 'tasks') as task
  join public.run_sections as rs on rs.run_id = v_run_id and rs.position = (section ->> 'position')::integer
  left join jsonb_each_text(v_assignments) as a (task_id, assignee_id) on lower(a.task_id) = task ->> 'id'
  left join public.profiles as p on p.id::text = lower(a.assignee_id)
  left join lateral (
    select f ->> 'position' as field_position
    from jsonb_array_elements(coalesce(v_content -> 'fields', '[]'::jsonb)) as f
    where f ->> 'id' = task -> 'show_when' ->> 'field_id'
  ) as vf on true
  left join public.run_fields as rf on rf.run_id = v_run_id and rf.position = vf.field_position::integer;

  return v_run_id;
end;
$$;

-- ── 4. Зміна відповіді — атомарно (AC-LOGIC-02, -04, -05) ────────────────────
-- security definer: пише run_fields і run_tasks, на які в authenticated немає update. Чотири умови AGENTS.md: схема
-- private, search_path = '', перевірка доступу (менеджер запуску або адміністратор) до запису, revoke execute нижче.
create or replace function private.set_run_field_answer(p_field_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_role           text := coalesce((select private.current_app_role()), '');
  v_run_id         uuid;
  v_run_manager_id uuid;
  v_options        text[];
  v_answer         text;
  v_answer_new     text := nullif(p_answer, '');
begin
  select f.run_id, r.run_manager_id into v_run_id, v_run_manager_id
  from public.run_fields as f
  join public.runs as r on r.id = f.run_id
  where f.id = p_field_id;

  -- Лише менеджер запуску або адміністратор; виконавець задачі й вендор — відмова (AC-LOGIC-05).
  if not found or v_uid is null
     or not (v_role = 'admin' or (v_role = 'manager' and v_run_manager_id = v_uid)) then
    raise exception 'ANSWER_NOT_ALLOWED' using errcode = '42501';
  end if;

  -- Відповіді й позначки одного запуску — по черзі (як mark_task_done).
  perform 1 from public.runs where id = v_run_id for update;

  select f.options, f.answer into v_options, v_answer from public.run_fields as f where f.id = p_field_id;

  if v_answer_new is not null and not (v_answer_new = any (v_options)) then
    raise exception 'INVALID_ANSWER' using errcode = '22023';
  end if;

  if v_answer is not distinct from v_answer_new then
    return;
  end if;

  update public.run_fields set answer = v_answer_new where id = p_field_id;

  -- Змінена відповідь повертає залежну задачу до «to do» (AC-LOGIC-04) і показує задачі своєї відповіді (AC-LOGIC-02).
  update public.run_tasks
  set status = 'to_do',
      is_shown = (show_when_value = v_answer_new) is true
  where show_when_field_id = p_field_id;

  -- Статус запуску — за показаними обов'язковими задачами, те саме правило, що й «Завершення запуску».
  update public.runs
  set status = case
    when exists (
      select 1 from public.run_tasks
      where run_id = v_run_id and is_shown and is_required and status <> 'done'
    ) then 'in_progress'
    else 'completed'
  end
  where id = v_run_id;
end;
$$;

revoke execute on function private.set_run_field_answer(uuid, text) from public, anon;
grant execute on function private.set_run_field_answer(uuid, text) to authenticated;

create or replace function public.set_run_field_answer(p_field_id uuid, p_answer text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_run_field_answer(p_field_id, p_answer);
$$;

revoke execute on function public.set_run_field_answer(uuid, text) from public, anon;
grant execute on function public.set_run_field_answer(uuid, text) to authenticated;

-- ── 5. Початкові дані: шаблон «Repair» (AC-LOGIC-01) ─────────────────────────
-- 4 обов'язкові задачі; «Send an emergency plumber» — лише коли «Urgency» = «urgent». Версія 1 без незбережених змін.
-- Пропускаємо, якщо шаблон із такою назвою вже є (назву могли зайняти в редакторі).
do $$
declare
  v_template constant uuid := '10000000-0000-4000-8000-000000000003';
  v_field    constant uuid := '10000000-0000-4000-8000-000000000031';
begin
  if exists (
    select 1 from public.templates
    where id = v_template or lower(private.clean_name(name)) = 'repair'
  ) then
    return;
  end if;

  insert into public.templates (id, name) values (v_template, 'Repair');

  insert into public.template_fields (id, template_id, name, options, position)
  values (v_field, v_template, 'Urgency', array['urgent', 'not urgent'], 1);

  insert into public.template_sections (id, template_id, name, position) values
    ('10000000-0000-4000-8000-000000000032', v_template, 'Assessment', 1),
    ('10000000-0000-4000-8000-000000000033', v_template, 'Works', 2);

  insert into public.template_tasks (
    id, template_id, section_id, name, is_required, position, show_when_field_id, show_when_value
  ) values
    ('10000000-0000-4000-8000-000000000301', v_template, '10000000-0000-4000-8000-000000000032',
     'Inspect the leak', true, 1, null, null),
    ('10000000-0000-4000-8000-000000000302', v_template, '10000000-0000-4000-8000-000000000032',
     'Send an emergency plumber', true, 2, v_field, 'urgent'),
    ('10000000-0000-4000-8000-000000000303', v_template, '10000000-0000-4000-8000-000000000033',
     'Fix the leak', true, 1, null, null),
    ('10000000-0000-4000-8000-000000000304', v_template, '10000000-0000-4000-8000-000000000033',
     'Check the result', true, 2, null, null);

  insert into public.template_versions (template_id, number, content, created_by)
  values (v_template, 1, private.template_snapshot(v_template) || jsonb_build_object('name', 'Repair'), null);

  update public.templates set current_version = 1, has_unpublished_changes = false where id = v_template;
end;
$$;
