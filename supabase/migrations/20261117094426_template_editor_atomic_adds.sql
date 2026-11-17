-- Рев'ю безпеки й архітектури (2026-11-17), знахідка 7: редактор шаблону додає розділ чи задачу за схемою «прочитати
-- max(position), потім записати» двома окремими запитами. Подвійний клік (або дві вкладки) дає однакову позицію й
-- помилку унікальності (template_sections_position_key / template_tasks_section_position_key), а перейменування
-- шаблону — «update, а якщо рядків немає — insert» з тією самою гонкою. Виправлення:
--   1) add_template_section і add_template_task — одна функція = одна транзакція: блокування рядка шаблону
--      (for update) і позиція max + 1 в тому самому запиті, що й вставка;
--   2) upsert робочої назви (renameTemplate): PostgREST генерує
--      `insert … on conflict (template_id) do update set template_id = excluded.template_id, name = excluded.name`,
--      а Postgres перевіряє право UPDATE на КОЖНУ колонку в `set`, навіть якщо значення те саме, — тож додаємо
--      колонковий grant update (template_id). Політики (лише admin) не змінюються; значення template_id у upsert —
--      те саме, що в конфлікті, тож рядок на інший шаблон він не «переносить».
-- Блокування рядка шаблону — те саме, що вже беруть save_template_version і тригер mark_unpublished: зміни робочої
-- копії одного шаблону йдуть по черзі.

-- ── 1) Розділ ────────────────────────────────────────────────────────────────
create or replace function private.add_template_section(p_template_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Першим рядком — роль: security definer обходить RLS, тож без цієї перевірки менеджер додав би розділ прямим RPC.
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  perform 1 from public.templates as t where t.id = p_template_id for update;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.template_sections (template_id, name, position)
  select p_template_id, p_name, coalesce(max(s.position), 0) + 1
  from public.template_sections as s
  where s.template_id = p_template_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function private.add_template_section(uuid, text) from public, anon;
grant execute on function private.add_template_section(uuid, text) to authenticated;

create or replace function public.add_template_section(p_template_id uuid, p_name text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.add_template_section(p_template_id, p_name);
$$;

revoke execute on function public.add_template_section(uuid, text) from public, anon;
grant execute on function public.add_template_section(uuid, text) to authenticated;

-- ── 1) Задача ────────────────────────────────────────────────────────────────
-- Розділ мусить належати цьому шаблону (інакше — TEMPLATE_ITEM_NOT_FOUND, як і для відсутнього).
create or replace function private.add_template_task(
  p_template_id uuid,
  p_section_id  uuid,
  p_name        text,
  p_is_required boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  perform 1 from public.templates as t where t.id = p_template_id for update;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.template_sections as s where s.id = p_section_id and s.template_id = p_template_id;
  if not found then
    raise exception 'TEMPLATE_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.template_tasks (template_id, section_id, name, is_required, position)
  select p_template_id, p_section_id, p_name, coalesce(p_is_required, false), coalesce(max(tt.position), 0) + 1
  from public.template_tasks as tt
  where tt.section_id = p_section_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function private.add_template_task(uuid, uuid, text, boolean) from public, anon;
grant execute on function private.add_template_task(uuid, uuid, text, boolean) to authenticated;

create or replace function public.add_template_task(
  p_template_id uuid,
  p_section_id  uuid,
  p_name        text,
  p_is_required boolean default false
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.add_template_task(p_template_id, p_section_id, p_name, p_is_required);
$$;

revoke execute on function public.add_template_task(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.add_template_task(uuid, uuid, text, boolean) to authenticated;

-- ── 2) upsert робочої назви ──────────────────────────────────────────────────
grant update (template_id) on table public.template_draft_names to authenticated;
