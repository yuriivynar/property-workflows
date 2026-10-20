-- Виправлення за /opsx:verify impl-workflow-runs (застосовані міграції не редагуємо — лише нова міграція).
--
-- 1) Назва випадку (AC-RUN-03, AC-RUN-07): форма обрізає пробільні символи на краях через JS trim(), а база — лише
--    через Postgres \s, який не бачить, наприклад, нерозривного пробілу U+00A0. Прямим RPC проходила назва, що
--    виглядає порожньою. Тепер база обрізає й перевіряє той самий набір символів, що й String.prototype.trim().
-- 2) Ключі призначень p_assignments порівнюються без урахування регістру UUID.
-- 3) Задача шаблону не може посилатися на розділ іншого шаблону: launch_run зіставляє розділи за позицією, тож така
--    задача мовчки потрапила б не в той розділ (AC-RUN-01, AC-RUN-02).

-- Пробільні символи String.prototype.trim(): \s Postgres + U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F,
-- U+205F, U+3000, U+FEFF.
alter table public.runs drop constraint runs_case_name_check;

alter table public.runs
  add constraint runs_case_name_check check (
    char_length(case_name) between 1 and 100
    and case_name !~ '^[\s   -     　﻿]'
    and case_name !~ '[\s   -     　﻿]$'
  );

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
  v_case_name     text := regexp_replace(
    coalesce(p_case_name, ''),
    '^[\s   -     　﻿]+|[\s   -     　﻿]+$',
    '',
    'g'
  );
  v_assignments   jsonb := coalesce(p_assignments, '{}'::jsonb);
  v_template_name text;
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

  select t.name into v_template_name from public.templates as t where t.id = p_template_id;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if jsonb_typeof(v_assignments) <> 'object' then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  -- jsonb розрізняє ключі "abc…" і "ABC…"; після lower() вони вказали б на ту саму задачу шаблону, і запуск отримав би
  -- її двічі (AC-RUN-01). Такий набір призначень неоднозначний — відхиляємо.
  if (select count(*) from jsonb_object_keys(v_assignments))
     <> (select count(distinct lower(k)) from jsonb_object_keys(v_assignments) as k) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  -- Виконавець — лише менеджер або адміністратор. UUID порівнюємо в нижньому регістрі.
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, assignee_id)
    join public.template_tasks as tt on tt.id::text = lower(a.task_id) and tt.template_id = p_template_id
    left join public.profiles as p on p.id::text = lower(a.assignee_id) and p.role in ('manager', 'admin')
    where p.id is null
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  -- Рівно один запуск «in progress»; менеджер запуску — той, хто запустив (AC-RUN-01, AC-RUN-05, AC-RUN-06).
  insert into public.runs (template_id, template_name, case_name, run_manager_id)
  values (p_template_id, v_template_name, v_case_name, v_uid)
  returning id into v_run_id;

  -- Копія розділів і задач на момент запуску (AC-RUN-02); усі задачі «to do» (AC-RUN-01).
  insert into public.run_sections (run_id, name, position)
  select v_run_id, s.name, s.position
  from public.template_sections as s
  where s.template_id = p_template_id;

  insert into public.run_tasks (run_id, section_id, name, is_required, position, assignee_id)
  select v_run_id, rs.id, tt.name, tt.is_required, tt.position, coalesce(p.id, v_uid)
  from public.template_tasks as tt
  join public.template_sections as ts on ts.id = tt.section_id
  join public.run_sections as rs on rs.run_id = v_run_id and rs.position = ts.position
  left join jsonb_each_text(v_assignments) as a (task_id, assignee_id) on lower(a.task_id) = tt.id::text
  left join public.profiles as p on p.id::text = lower(a.assignee_id)
  where tt.template_id = p_template_id;

  return v_run_id;
end;
$$;

-- create or replace зберігає права функції; повторюємо їх явно, щоб міграція читалась сама по собі.
revoke execute on function private.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function private.launch_run(uuid, text, jsonb) to authenticated;

-- Задача шаблону — лише в розділі того самого шаблону.
alter table public.template_sections
  add constraint template_sections_id_template_key unique (id, template_id);

alter table public.template_tasks
  add constraint template_tasks_section_template_fkey
  foreign key (section_id, template_id) references public.template_sections (id, template_id) on delete cascade;
