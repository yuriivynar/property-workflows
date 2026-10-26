-- Версії шаблонів (openspec/specs/template-versions; openspec/changes/impl-template-versions/design.md, розділи 1–5).
--
-- template_sections / template_tasks стають НЕЗБЕРЕЖЕНИМИ ЗМІНАМИ (робоча копія адміністратора, одна на шаблон);
-- збережена версія — незмінний jsonb-знімок у template_versions; запуск береться з поточної версії.
-- Права: робочу копію бачить і змінює лише admin (окрема політика на кожну операцію + колонкові grant);
-- версію створює лише функція save_template_version; позначку й номер поточної версії змінюють лише тригер і функція.

-- ── Позначка незбережених змін і поточна версія (design.md, розділ 1) ─────────
alter table public.templates
  add column current_version integer,
  add column has_unpublished_changes boolean not null default true;

comment on column public.templates.current_version is
  'Номер поточної версії; null — шаблон ще не зберігали (менеджер його не бачить, AC-EDITOR-02).';
comment on column public.templates.has_unpublished_changes is
  'Позначка «Unpublished changes» (AC-EDITOR-01). Змінюють лише тригер private.mark_unpublished і save_template_version.';

-- Порожніх назв не буває (робоче рішення до solomchaak/property-workflows-spec#28).
alter table public.templates add constraint templates_name_not_blank check (char_length(btrim(name)) > 0);
alter table public.template_sections
  add constraint template_sections_name_not_blank check (char_length(btrim(name)) > 0);
alter table public.template_tasks add constraint template_tasks_name_not_blank check (char_length(btrim(name)) > 0);

-- ── Версії — незмінні знімки (design.md, розділ 2) ───────────────────────────
create table public.template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  number      integer not null check (number > 0),
  -- {"sections": [{"id", "name", "position", "tasks": [{"id", "name", "is_required", "position"}]}]}
  content     jsonb not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint template_versions_number_key unique (template_id, number)
);

comment on table public.template_versions is
  'Збережена версія шаблону — незмінний знімок (AC-EDITOR-03, AC-EDITOR-05). Створює лише save_template_version.';

-- Номер версії запуску — копія, як template_name: менеджер не читає старих версій, але бачить номер (AC-EDITOR-06).
alter table public.runs add column template_version integer;

-- Знімок робочої копії шаблону: розділи за позицією, задачі за позицією.
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
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'position', s.position,
          'tasks', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object('id', tt.id, 'name', tt.name, 'is_required', tt.is_required, 'position', tt.position)
                order by tt.position
              ),
              '[]'::jsonb
            )
            from public.template_tasks as tt
            where tt.section_id = s.id
          )
        )
        order by s.position
      ),
      '[]'::jsonb
    )
  )
  from public.template_sections as s
  where s.template_id = p_template_id;
$$;

revoke execute on function private.template_snapshot(uuid) from public, anon, authenticated;

-- ── Наявні дані стають версією 1 (design.md, розділ 5) ───────────────────────
-- Автор — перший адміністратор, якщо він уже є (на чистій базі CI профілів ще немає → null, у списку версій «—»).
insert into public.template_versions (template_id, number, content, created_by)
select t.id, 1, private.template_snapshot(t.id),
       (select p.id from public.profiles as p where p.role = 'admin' order by p.created_at limit 1)
from public.templates as t;

update public.templates set current_version = 1, has_unpublished_changes = false;

-- Запуски, створені до появи версій, — з версії 1 (робоче рішення до solomchaak/property-workflows-spec#33).
update public.runs set template_version = 1 where template_version is null;

-- ── RLS і права (design.md, розділ 3: окрема політика на кожну операцію) ─────
alter table public.template_versions enable row level security;

revoke all on table public.template_versions from anon, authenticated;
grant select on table public.template_versions to authenticated;
grant select, insert, update, delete on table public.template_versions to service_role;

-- templates: admin бачить усі; manager — лише збережені (AC-EDITOR-02). Створює лише admin, лише назву.
drop policy templates_select_all on public.templates;

create policy templates_select_admin_or_saved
  on public.templates for select to authenticated
  using ((select private.current_app_role()) = 'admin' or current_version is not null);

create policy templates_insert_admin
  on public.templates for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');

-- Лише назва: current_version і has_unpublished_changes користувач не задає й не змінює (як profiles.role).
grant insert (name) on table public.templates to authenticated;

-- template_sections / template_tasks — незбережені зміни: лише admin, кожна операція окремо (AC-EDITOR-02, AC-EDITOR-08).
drop policy template_sections_select_all on public.template_sections;
drop policy template_tasks_select_all on public.template_tasks;

create policy template_sections_select_admin
  on public.template_sections for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy template_sections_insert_admin
  on public.template_sections for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');

create policy template_sections_update_admin
  on public.template_sections for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy template_sections_delete_admin
  on public.template_sections for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy template_tasks_select_admin
  on public.template_tasks for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy template_tasks_insert_admin
  on public.template_tasks for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');

create policy template_tasks_update_admin
  on public.template_tasks for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy template_tasks_delete_admin
  on public.template_tasks for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Колонкові права: template_id (до якого шаблону належить) після створення не змінюється.
grant insert (template_id, name, position) on table public.template_sections to authenticated;
grant update (name, position) on table public.template_sections to authenticated;
grant delete on table public.template_sections to authenticated;
grant insert (template_id, section_id, name, is_required, position) on table public.template_tasks to authenticated;
grant update (name, is_required, position, section_id) on table public.template_tasks to authenticated;
grant delete on table public.template_tasks to authenticated;

-- template_versions: admin — усі; manager — лише поточна версія збереженого шаблону (AC-EDITOR-02, AC-EDITOR-07).
create policy template_versions_select_admin_or_current
  on public.template_versions for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or exists (
      select 1 from public.templates as t
      where t.id = template_versions.template_id and t.current_version = template_versions.number
    )
  );

-- ── Позначка «Unpublished changes» після будь-якої зміни робочої копії (AC-EDITOR-01) ──
create or replace function private.mark_unpublished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.templates
  set has_unpublished_changes = true
  where id = coalesce(new.template_id, old.template_id) and not has_unpublished_changes;
  return null;
end;
$$;

revoke execute on function private.mark_unpublished() from public, anon, authenticated;

create trigger template_sections_mark_unpublished
  after insert or update or delete on public.template_sections
  for each row execute function private.mark_unpublished();

create trigger template_tasks_mark_unpublished
  after insert or update or delete on public.template_tasks
  for each row execute function private.mark_unpublished();

-- ── Збереження версії (AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-08) ─────────────
create or replace function private.save_template_version(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current  integer;
  v_changed  boolean;
  v_number   integer;
begin

  select t.current_version, t.has_unpublished_changes into v_current, v_changed
  from public.templates as t
  where t.id = p_template_id
  for update;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_changed then
    raise exception 'NO_UNPUBLISHED_CHANGES' using errcode = '22023';        -- solomchaak/property-workflows-spec#22
  end if;

  if not exists (
    select 1 from public.template_tasks as tt where tt.template_id = p_template_id and tt.is_required
  ) then
    raise exception 'TEMPLATE_NEEDS_REQUIRED_TASK' using errcode = '22023';  -- AC-EDITOR-04
  end if;

  v_number := coalesce(v_current, 0) + 1;

  insert into public.template_versions (template_id, number, content, created_by)
  values (p_template_id, v_number, private.template_snapshot(p_template_id), (select auth.uid()));

  update public.templates
  set current_version = v_number, has_unpublished_changes = false
  where id = p_template_id;

  return v_number;
end;
$$;

revoke execute on function private.save_template_version(uuid) from public, anon;
grant execute on function private.save_template_version(uuid) to authenticated;

create or replace function public.save_template_version(p_template_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.save_template_version(p_template_id);
$$;

revoke execute on function public.save_template_version(uuid) from public, anon;
grant execute on function public.save_template_version(uuid) to authenticated;

-- ── Перестановка розділу чи задачі на одну позицію (AC-EDITOR-08) ────────────
create or replace function private.move_template_item(p_kind text, p_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template uuid;
  v_section  uuid;
  v_position integer;
  v_other    uuid;
  v_other_position integer;
begin
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  if p_direction not in (-1, 1) or p_kind not in ('section', 'task') then
    raise exception 'INVALID_MOVE' using errcode = '22023';
  end if;

  if p_kind = 'section' then
    select s.template_id, s.position into v_template, v_position
    from public.template_sections as s where s.id = p_id for update;
    if not found then
      raise exception 'TEMPLATE_ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;

    select s.id, s.position into v_other, v_other_position
    from public.template_sections as s
    where s.template_id = v_template
      and (case when p_direction < 0 then s.position < v_position else s.position > v_position end)
    order by s.position * p_direction
    limit 1
    for update;
    if not found then
      return;                                                                -- уже перший / останній
    end if;

    -- unique (template_id, position): міняємо через тимчасову позицію.
    update public.template_sections set position = -1 where id = p_id;
    update public.template_sections set position = v_position where id = v_other;
    update public.template_sections set position = v_other_position where id = p_id;
  else
    select tt.section_id, tt.position into v_section, v_position
    from public.template_tasks as tt where tt.id = p_id for update;
    if not found then
      raise exception 'TEMPLATE_ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;

    select tt.id, tt.position into v_other, v_other_position
    from public.template_tasks as tt
    where tt.section_id = v_section
      and (case when p_direction < 0 then tt.position < v_position else tt.position > v_position end)
    order by tt.position * p_direction
    limit 1
    for update;
    if not found then
      return;
    end if;

    update public.template_tasks set position = v_other_position where id = p_id;
    update public.template_tasks set position = v_position where id = v_other;
  end if;
end;
$$;

revoke execute on function private.move_template_item(text, uuid, integer) from public, anon;
grant execute on function private.move_template_item(text, uuid, integer) to authenticated;

create or replace function public.move_template_item(p_kind text, p_id uuid, p_direction integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.move_template_item(p_kind, p_id, p_direction);
$$;

revoke execute on function public.move_template_item(text, uuid, integer) from public, anon;
grant execute on function public.move_template_item(text, uuid, integer) to authenticated;

-- ── Запуск — з поточної версії (design.md, розділ 4; AC-EDITOR-06, AC-RUN-01…12) ──
create or replace function private.launch_run(
  p_template_id uuid,
  p_case_name   text,
  p_assignments jsonb default '{}'::jsonb
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

  -- Виконавець задачі поточної версії — лише менеджер або адміністратор.
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, assignee_id)
    join (
      select task ->> 'id' as id
      from jsonb_array_elements(v_content -> 'sections') as section,
           jsonb_array_elements(section -> 'tasks') as task
    ) as vt on vt.id = lower(a.task_id)
    left join public.profiles as p on p.id::text = lower(a.assignee_id) and p.role in ('manager', 'admin')
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

revoke execute on function private.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function private.launch_run(uuid, text, jsonb) to authenticated;
