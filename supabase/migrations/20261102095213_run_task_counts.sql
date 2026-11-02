-- Лічильник задач запуску одним викликом: скільки задач «done» і скільки всього (openspec/specs/run-progress).
-- Знадобиться для рядка прогресу виконавця («N of K done»), щоб сторінки не рахували задачі самі.

create or replace function public.run_task_counts(p_run_id uuid)
returns table (done_count integer, total_count integer)
language sql
stable
security definer
as $$
  select count(*) filter (where t.status = 'done')::integer,
         count(*)::integer
  from public.run_tasks as t
  where t.run_id = p_run_id;
$$;

grant execute on function public.run_task_counts(uuid) to authenticated;
