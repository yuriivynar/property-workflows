-- Підтвердження останньої обов'язкової задачі перевіряє база, а не лише інтерфейс (рішення PM у
-- solomchaak/property-workflows-spec#15; AC-TASK-04, AC-TASK-16; зауваження рев'ю PR #10).
-- Без цього кнопка на застарілій сторінці (коли інша обов'язкова задача тим часом стала «done») завершила б запуск без
-- підтвердження. Тепер позначка останньої обов'язкової задачі «to do» без p_confirmed = true — помилка
-- CONFIRMATION_REQUIRED, і нічого не змінюється. Інші задачі позначаються, як і раніше, без підтвердження
-- (AC-TASK-01, AC-TASK-02, AC-TASK-07). Сигнатура змінюється, тож функції перестворюємо.

drop function public.mark_task_done(uuid);
drop function private.mark_task_done(uuid);

create function private.mark_task_done(p_task_id uuid, p_confirmed boolean default false)
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
     or not (v_role = 'admin' or v_run_manager_id = v_uid or v_assignee_id = v_uid) then
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

revoke execute on function private.mark_task_done(uuid, boolean) from public, anon;
grant execute on function private.mark_task_done(uuid, boolean) to authenticated;

create function public.mark_task_done(p_task_id uuid, p_confirmed boolean default false)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_task_done(p_task_id, p_confirmed);
$$;

revoke execute on function public.mark_task_done(uuid, boolean) from public, anon;
grant execute on function public.mark_task_done(uuid, boolean) to authenticated;
