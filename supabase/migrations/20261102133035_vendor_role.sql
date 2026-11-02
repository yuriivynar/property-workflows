-- Роль vendor і права вендора (зріз 3: openspec/specs/vendor-work, openspec/changes/impl-vendor-assignees/design.md;
-- requirements/39-assign-a-vendor.md, матриця прав у requirements/product.md).
--
-- 1) Роль: новий profiles_role_check з 'vendor'. Порядок — як у 20261012000000_profiles_and_roles.sql: старий constraint
--    знімаємо першим; наявні дані не змінюються (manager і admin лишаються); default колонки лишається 'manager'.
-- 2) RLS: вендор не бачить шаблонів і версій (AC-VENDOR-08); рядків runs і run_overview — теж (назва шаблону, версія,
--    менеджер запуску й прогрес усього запуску — не для вендора: AC-VENDOR-04, матриця «See which template version»);
--    у run_tasks — лише свої задачі, у run_sections — лише розділи зі своїми задачами (AC-VENDOR-04, AC-VENDOR-06).
-- 3) Функції: у виборі виконавця — і вендори (AC-VENDOR-02); вендор може бути виконавцем задачі (AC-VENDOR-01);
--    список запусків вендора й його задачі — функціями, що повертають лише дозволене (AC-VENDOR-03…06, AC-VENDOR-10).
-- Запуск шаблону вендором відхиляє launch_run (перевірка ролі, AC-VENDOR-09); позначку чужої задачі — mark_task_done
-- (вендор ніколи не менеджер запуску, AC-VENDOR-07). Обидві перевірки вже були й лишаються без змін.

-- ── 1. Роль vendor ──────────────────────────────────────────────────────────
alter table public.profiles drop constraint profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'admin', 'vendor'));

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
-- Шаблони: admin — усі; manager — збережені (AC-EDITOR-02); vendor — жодного (AC-VENDOR-08).
drop policy templates_select_admin_or_saved on public.templates;

create policy templates_select_admin_or_saved
  on public.templates for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager' and current_version is not null)
  );

-- Версії: admin — усі; manager — лише поточна (AC-EDITOR-07); vendor — жодної.
drop policy template_versions_select_admin_or_current on public.template_versions;

create policy template_versions_select_admin_or_current
  on public.template_versions for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) = 'manager'
      and exists (
        select 1 from public.templates as t
        where t.id = template_versions.template_id and t.current_version = template_versions.number
      )
    )
  );

-- Задача, яку бачить користувач: у видимому запуску; вендору — лише власна. security definer — щоб політики
-- run_sections і run_tasks не посилались одна на одну (42P17), як private.can_see_run.
create or replace function private.can_see_run_task(p_run_id uuid, p_assignee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_see_run(p_run_id)
     and (
       (select private.current_app_role()) is distinct from 'vendor'
       or p_assignee_id = (select auth.uid())
     );
$$;

revoke execute on function private.can_see_run_task(uuid, uuid) from public, anon;
grant execute on function private.can_see_run_task(uuid, uuid) to authenticated;

-- Розділ, який бачить користувач: у видимому запуску; вендору — лише розділ, де є його задача.
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
         where t.section_id = p_section_id and t.assignee_id = (select auth.uid())
       )
     );
$$;

revoke execute on function private.can_see_run_section(uuid, uuid) from public, anon;
grant execute on function private.can_see_run_section(uuid, uuid) to authenticated;

drop policy runs_select_visible on public.runs;

create policy runs_select_visible
  on public.runs for select to authenticated
  using (private.can_see_run(id) and (select private.current_app_role()) is distinct from 'vendor');

drop policy run_sections_select_visible on public.run_sections;

create policy run_sections_select_visible
  on public.run_sections for select to authenticated
  using (private.can_see_run_section(run_id, id));

drop policy run_tasks_select_visible on public.run_tasks;

create policy run_tasks_select_visible
  on public.run_tasks for select to authenticated
  using (private.can_see_run_task(run_id, assignee_id));

-- ── 3. Довідник колег: і вендори (AC-VENDOR-02) ─────────────────────────────
-- Бачать лише менеджер і адміністратор (вендор — «—» у матриці: email інших користувачів), лише email (AC-RUN-10).
create or replace function private.staff_directory()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where (select private.current_app_role()) in ('manager', 'admin')
    and p.role in ('manager', 'admin', 'vendor')
  order by p.email;
$$;

-- ── 4. Запуск: вендор — виконавець задачі (AC-VENDOR-01) ────────────────────
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

  insert into public.run_tasks (run_id, section_id, name, is_required, position, assignee_id)
  select v_run_id, rs.id, task ->> 'name', (task ->> 'is_required')::boolean, (task ->> 'position')::integer,
         coalesce(p.id, v_uid)
  from jsonb_array_elements(v_content -> 'sections') as section
  cross join jsonb_array_elements(section -> 'tasks') as task
  join public.run_sections as rs on rs.run_id = v_run_id and rs.position = (section ->> 'position')::integer
  left join jsonb_each_text(v_assignments) as a (task_id, assignee_id) on lower(a.task_id) = task ->> 'id'
  left join public.profiles as p on p.id::text = lower(a.assignee_id);

  return v_run_id;
end;
$$;

-- ── 5. Список запусків вендора і його задачі (AC-VENDOR-03…06, AC-VENDOR-10) ─
-- Рядки runs вендору закрито (п. 2), тож назву випадку, статус запуску й «Your tasks: N of K done» він отримує лише
-- звідси: тільки запуски, де він виконавець, і лише лічильники його задач («Припущення» PM). Іншим ролям — порожньо.
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
  join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())
  where (select private.current_app_role()) = 'vendor'
  group by r.id
  order by r.created_at desc;
$$;

revoke execute on function private.vendor_runs() from public, anon;
grant execute on function private.vendor_runs() to authenticated;

create or replace function public.vendor_runs()
returns table (id uuid, case_name text, status text, created_at timestamptz, my_done integer, my_total integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.case_name, v.status, v.created_at, v.my_done, v.my_total from private.vendor_runs() as v;
$$;

revoke execute on function public.vendor_runs() from public, anon;
grant execute on function public.vendor_runs() to authenticated;

-- Задачі вендора в запуску: назва, розділ, обов'язковість і статус (AC-VENDOR-04) і чи просить позначка підтвердження —
-- остання обов'язкова задача «to do» запуску («Припущення» PM; ту саму умову перевіряє mark_task_done). Чужий запуск
-- чи запуск без задач вендора — порожньо (AC-VENDOR-06).
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
           where o.run_id = t.run_id and o.is_required and o.status <> 'done' and o.id <> t.id
         ))
  from public.run_tasks as t
  join public.run_sections as s on s.id = t.section_id
  where t.run_id = p_run_id
    and t.assignee_id = (select auth.uid())
    and (select private.current_app_role()) = 'vendor'
  order by s.position, t.position;
$$;

revoke execute on function private.vendor_run_tasks(uuid) from public, anon;
grant execute on function private.vendor_run_tasks(uuid) to authenticated;

create or replace function public.vendor_run_tasks(p_run_id uuid)
returns table (
  id uuid, name text, is_required boolean, status text, task_position integer,
  section_name text, section_position integer, needs_confirmation boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.name, v.is_required, v.status, v.task_position, v.section_name, v.section_position,
         v.needs_confirmation
  from private.vendor_run_tasks(p_run_id) as v;
$$;

revoke execute on function public.vendor_run_tasks(uuid) from public, anon;
grant execute on function public.vendor_run_tasks(uuid) to authenticated;

-- ── 6. Позначка: право менеджера запуску — лише за поточної ролі manager (AC-VENDOR-07) ─
-- Вендор ніколи не менеджер запуску («Припущення» PM), але якщо колишньому менеджеру змінять роль на vendor
-- (питання solomchaak/property-workflows-spec#45), run_manager_id лишиться його: без перевірки ролі він позначав би
-- будь-яку задачу свого колишнього запуску (рецензія CodeRabbit, CWE-863). Решта функції — без змін.
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

  -- Позначки задач одного запуску — по черзі; стан нижче читаємо вже після блокування.
  perform 1 from public.runs where id = v_run_id for update;

  select t.status, t.is_required into v_status, v_is_required from public.run_tasks as t where t.id = p_task_id;
  if v_status = 'done' then
    return;
  end if;

  -- Остання обов'язкова задача «to do» завершить запуск — лише з підтвердженням.
  if v_is_required and not coalesce(p_confirmed, false) and not exists (
    select 1 from public.run_tasks
    where run_id = v_run_id and is_required and status <> 'done' and id <> p_task_id
  ) then
    raise exception 'CONFIRMATION_REQUIRED' using errcode = '22023';
  end if;

  update public.run_tasks set status = 'done' where id = p_task_id;

  if not exists (
    select 1 from public.run_tasks
    where run_id = v_run_id and is_required and status <> 'done'
  ) then
    update public.runs set status = 'completed' where id = v_run_id and status <> 'completed';
  end if;
end;
$$;
