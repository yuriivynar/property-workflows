-- Позначка задач, завершення запуску й прогрес (openspec/specs/run-progress;
-- openspec/changes/impl-workflow-runs/design.md, рішення 4).
--
-- Права не змінюються: для authenticated на run_tasks і runs — лише select під RLS. Позначка змінює задачу й, можливо,
-- статус запуску однією транзакцією — функцією mark_task_done (логіка в private, security definer; у public —
-- обгортка security invoker для supabase.rpc).

-- ── Позначка задачі виконаною ───────────────────────────────────────────────
-- Дозволено виконавцю задачі, менеджеру запуску й адміністратору (AC-TASK-01, AC-TASK-02, AC-TASK-07); іншому —
-- NOT_ALLOWED, і для чужої, і для відсутньої задачі, щоб не підказувати, що вона існує (AC-TASK-03).
-- Повторна позначка нічого не змінює («Припущення» PM). Коли обов'язкових задач «to do» не лишилось — запуск
-- completed (AC-TASK-04).
create or replace function private.mark_task_done(p_task_id uuid)
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

  -- Позначки задач одного запуску — по черзі: друга транзакція чекає на першу й бачить її зміну,
  -- тож запуск не лишиться in_progress, коли дві останні обов'язкові задачі позначили одночасно.
  perform 1 from public.runs where id = v_run_id for update;

  select t.status into v_status from public.run_tasks as t where t.id = p_task_id;
  if v_status = 'done' then
    return;
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

revoke execute on function private.mark_task_done(uuid) from public, anon;
grant execute on function private.mark_task_done(uuid) to authenticated;

create or replace function public.mark_task_done(p_task_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mark_task_done(p_task_id);
$$;

revoke execute on function public.mark_task_done(uuid) from public, anon;
grant execute on function public.mark_task_done(uuid) to authenticated;

-- ── Прогрес запуску ─────────────────────────────────────────────────────────
-- «N of M done»: N — задачі зі статусом done, M — усі задачі запуску, обов'язкові й ні (AC-TASK-05, AC-TASK-09).
-- security_invoker: подання читає runs і run_tasks з правами того, хто питає, тож діє та сама RLS (AC-TASK-06).
create view public.run_overview
with (security_invoker = true)
as
select
  r.id,
  r.case_name,
  r.template_name,
  r.status,
  r.run_manager_id,
  r.created_at,
  (count(t.id) filter (where t.status = 'done'))::integer as done_count,
  count(t.id)::integer as total_count
from public.runs as r
left join public.run_tasks as t on t.run_id = r.id
group by r.id;

revoke all on table public.run_overview from anon, authenticated;
grant select on table public.run_overview to authenticated;
grant select on table public.run_overview to service_role;
