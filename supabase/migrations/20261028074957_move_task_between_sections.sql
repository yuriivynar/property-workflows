-- Перенесення задачі в інший розділ (openspec/changes/impl-clarify-template-versions, design.md, рішення 3).
--
-- AC-EDITOR-28: адміністратор переносить задачу з «Move-in day» у «Before move-in» і зберігає — нова версія має
-- «Before move-in» з 3 задачами і «Move-in day» з 2. Зміна — у незбережених змінах (позначку ставить тригер
-- template_tasks_mark_unpublished); версію створює лише save_template_version.
-- Одна функція: перевірка ролі, розділу того самого шаблону й нова позиція — в одній транзакції (ADR 0003).

create function private.move_template_task_to_section(p_task uuid, p_section uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template      uuid;
  v_from_section  uuid;
  v_from_position integer;
  v_last          integer;
begin
  -- Першим рядком — роль: security definer обходить RLS.
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = '42501';                    -- AC-EDITOR-08
  end if;

  select tt.template_id, tt.section_id, tt.position into v_template, v_from_section, v_from_position
  from public.template_tasks as tt where tt.id = p_task for update;
  if not found then
    raise exception 'TEMPLATE_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Цільовий розділ — лише того самого шаблону; інакше та сама відповідь, що й для відсутнього.
  perform 1 from public.template_sections as s where s.id = p_section and s.template_id = v_template for update;
  if not found then
    raise exception 'TEMPLATE_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_section = v_from_section then
    return;                                                                  -- уже в цьому розділі
  end if;

  select coalesce(max(tt.position), 0) into v_last from public.template_tasks as tt where tt.section_id = p_section;

  -- Задача стає останньою в цільовому розділі; позиції у вихідному розділі стискаються.
  update public.template_tasks set section_id = p_section, position = v_last + 1 where id = p_task;
  update public.template_tasks set position = position - 1
  where section_id = v_from_section and position > v_from_position;
end;
$$;

revoke execute on function private.move_template_task_to_section(uuid, uuid) from public, anon;
grant execute on function private.move_template_task_to_section(uuid, uuid) to authenticated;

create function public.move_template_task_to_section(p_task uuid, p_section uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.move_template_task_to_section(p_task, p_section);
$$;

revoke execute on function public.move_template_task_to_section(uuid, uuid) from public, anon;
grant execute on function public.move_template_task_to_section(uuid, uuid) to authenticated;
