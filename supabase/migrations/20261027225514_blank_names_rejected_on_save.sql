-- Порожні назви не дають зберегти версію (openspec/changes/impl-clarify-template-versions, design.md, рішення 2).
--
-- AC-EDITOR-20: адміністратор очищує назву задачі чи розділу — це лишається в незбережених змінах, а збереження
-- відхилено з «Every section and task needs a name»; версії немає, зміни й позначка лишаються.
-- Обмеження *_name_not_blank знято лише з робочої копії; знімок версії з порожньою назвою неможливий — перевіряє
-- save_template_version до запису версії.

alter table public.template_sections drop constraint template_sections_name_not_blank;
alter table public.template_tasks drop constraint template_tasks_name_not_blank;

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

  -- Порожня назва можлива лише в незбережених змінах; у версію вона не потрапляє (AC-EDITOR-20).
  if exists (select 1 from public.template_sections as s where s.template_id = p_template_id and btrim(s.name) = '')
     or exists (select 1 from public.template_tasks as tt where tt.template_id = p_template_id and btrim(tt.name) = '') then
    raise exception 'TEMPLATE_NAME_MISSING' using errcode = '22023';         -- AC-EDITOR-20
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
