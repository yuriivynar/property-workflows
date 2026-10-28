-- Назва шаблону — частина версії (openspec/changes/impl-clarify-template-versions, design.md, рішення 1 з уточненням).
--
-- AC-EDITOR-21: перейменування діє лише з новою версією — до збереження менеджер бачить назву поточної версії.
-- AC-EDITOR-22: запуск показує назву своєї версії — templates.name завжди є назвою поточної версії, launch_run копіює її.
-- AC-EDITOR-24: зайнята назва відхиляється під час збереження (NAME_TAKEN), нової версії немає, зміни й позначка лишаються.
--
-- Робоча назва — окрема таблиця, а не колонка templates: на templates діє grant select на всю таблицю, і RLS обмежує
-- рядки, не колонки, — менеджер прочитав би незбережену назву (AC-EDITOR-02, AC-EDITOR-29).

create table public.template_draft_names (
  template_id uuid primary key references public.templates (id) on delete cascade,
  name        text not null,
  constraint template_draft_names_name_not_blank check (char_length(btrim(name)) > 0)
);

comment on table public.template_draft_names is
  'Назва шаблону в незбережених змінах (AC-EDITOR-21). Лише admin; save_template_version переносить її в templates.name.';

alter table public.template_draft_names enable row level security;

revoke all on table public.template_draft_names from anon, authenticated;
grant select, insert, update, delete on table public.template_draft_names to service_role;
grant select on table public.template_draft_names to authenticated;
grant insert (template_id, name) on table public.template_draft_names to authenticated;
grant update (name) on table public.template_draft_names to authenticated;
grant delete on table public.template_draft_names to authenticated;

-- Як решта робочої копії: лише admin, окрема політика на кожну операцію.
create policy template_draft_names_select_admin
  on public.template_draft_names for select to authenticated
  using ((select private.current_app_role()) = 'admin');

create policy template_draft_names_insert_admin
  on public.template_draft_names for insert to authenticated
  with check ((select private.current_app_role()) = 'admin');

create policy template_draft_names_update_admin
  on public.template_draft_names for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');

create policy template_draft_names_delete_admin
  on public.template_draft_names for delete to authenticated
  using ((select private.current_app_role()) = 'admin');

-- Перейменування — зміна робочої копії: та сама позначка «Unpublished changes» (AC-EDITOR-01).
create trigger template_draft_names_mark_unpublished
  after insert or update or delete on public.template_draft_names
  for each row execute function private.mark_unpublished();

create or replace function private.save_template_version(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current  integer;
  v_changed  boolean;
  v_name     text;
  v_number   integer;
begin
  -- Першим рядком — роль: security definer обходить RLS, тож без цієї перевірки менеджер зберіг би версію прямим RPC.
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  select t.current_version, t.has_unpublished_changes, coalesce(d.name, t.name)
  into v_current, v_changed, v_name
  from public.templates as t
  left join public.template_draft_names as d on d.template_id = t.id
  where t.id = p_template_id
  for update of t;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_changed then
    raise exception 'NO_UNPUBLISHED_CHANGES' using errcode = '22023';        -- AC-EDITOR-12
  end if;

  if exists (
    select 1 from public.template_sections as s
    where s.template_id = p_template_id
      and not exists (select 1 from public.template_tasks as tt where tt.section_id = s.id)
  ) then
    raise exception 'TEMPLATE_SECTION_EMPTY' using errcode = '22023';        -- AC-EDITOR-15
  end if;

  if not exists (
    select 1 from public.template_tasks as tt where tt.template_id = p_template_id and tt.is_required
  ) then
    raise exception 'TEMPLATE_NEEDS_REQUIRED_TASK' using errcode = '22023';  -- AC-EDITOR-04
  end if;

  -- Унікальність — до будь-якого запису; індекс templates_name_normalized_key — друга лінія (одночасні збереження).
  if exists (
    select 1 from public.templates as o
    where o.id <> p_template_id and lower(btrim(o.name)) = lower(btrim(v_name))
  ) then
    raise exception 'NAME_TAKEN' using errcode = '23505';                     -- AC-EDITOR-24
  end if;

  v_number := coalesce(v_current, 0) + 1;

  insert into public.template_versions (template_id, number, content, created_by)
  values (
    p_template_id,
    v_number,
    private.template_snapshot(p_template_id) || jsonb_build_object('name', v_name),  -- AC-EDITOR-21
    (select auth.uid())
  );

  -- Спершу прибрати робочу назву (її тригер ставить позначку), потім зняти позначку разом із новою назвою версії.
  delete from public.template_draft_names where template_id = p_template_id;

  update public.templates
  set name = v_name, current_version = v_number, has_unpublished_changes = false
  where id = p_template_id;

  return v_number;
end;
$$;

-- create or replace зберігає права; повторюємо явно, щоб міграція читалась сама по собі.
revoke execute on function private.save_template_version(uuid) from public, anon;
grant execute on function private.save_template_version(uuid) to authenticated;
