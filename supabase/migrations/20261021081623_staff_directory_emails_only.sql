-- Довідник колег — лише email (рішення PM у solomchaak/property-workflows-spec#5: варіант E; AC-RUN-10, AC-TASK-11).
-- Раніше staff_directory повертала й full_name. Тип результату змінюється, тож функції перестворюємо: спершу обгортку
-- в public, потім private.

drop function public.staff_directory();
drop function private.staff_directory();

create function private.staff_directory()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where (select private.current_app_role()) in ('manager', 'admin')
    and p.role in ('manager', 'admin')
  order by p.email;
$$;

revoke execute on function private.staff_directory() from public, anon;
grant execute on function private.staff_directory() to authenticated;

create function public.staff_directory()
returns table (id uuid, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.email from private.staff_directory() as d;
$$;

revoke execute on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;
