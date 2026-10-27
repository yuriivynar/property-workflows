-- Правила шаблонів після відповідей PM 27.10 (openspec/specs/template-versions; зміна clarify-template-versions).
-- Застосовані міграції не редагуємо — нова міграція.
--
-- 1) AC-EDITOR-15 (solomchaak/property-workflows-spec#24): версію з розділом без задач не створюємо —
--    save_template_version відхиляє збереження (TEMPLATE_SECTION_EMPTY), незбережені зміни й позначка лишаються.
-- 2) AC-EDITOR-23 (solomchaak/property-workflows-spec#30): назва шаблону унікальна без урахування регістру й пробілів
--    на краях — унікальний індекс за lower(btrim(name)); перевіряється при створенні шаблону.

create unique index templates_name_normalized_key on public.templates (lower(btrim(name)));

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
  -- Першим рядком — роль: security definer обходить RLS, тож без цієї перевірки менеджер зберіг би версію прямим RPC.
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  select t.current_version, t.has_unpublished_changes into v_current, v_changed
  from public.templates as t
  where t.id = p_template_id
  for update;
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

  v_number := coalesce(v_current, 0) + 1;

  insert into public.template_versions (template_id, number, content, created_by)
  values (p_template_id, v_number, private.template_snapshot(p_template_id), (select auth.uid()));

  update public.templates
  set current_version = v_number, has_unpublished_changes = false
  where id = p_template_id;

  return v_number;
end;
$$;

-- create or replace зберігає права; повторюємо явно, щоб міграція читалась сама по собі.
revoke execute on function private.save_template_version(uuid) from public, anon;
grant execute on function private.save_template_version(uuid) to authenticated;
