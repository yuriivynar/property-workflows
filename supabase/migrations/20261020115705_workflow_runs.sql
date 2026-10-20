-- Шаблони процесів і запуски: запуск — копія шаблону на момент запуску
-- (openspec/specs/run-launch; openspec/changes/impl-workflow-runs/design.md, рішення 2–4).
--
-- Права: для authenticated — лише select під RLS; insert / update / delete не видаємо зовсім.
-- Запуск шаблону змінює кілька таблиць однією транзакцією — функцією launch_run: логіка й перевірки в
-- private.launch_run (security definer, set search_path = ''), а public.launch_run — тонка обгортка security invoker
-- для supabase.rpc(…). Схема private поза Data API, тож напряму її функцій із публічним ключем не викликати.

-- ── Шаблони ─────────────────────────────────────────────────────────────────
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  name        text not null,
  position    integer not null,
  constraint template_sections_position_key unique (template_id, position)
);

create table public.template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  section_id  uuid not null references public.template_sections (id) on delete cascade,
  name        text not null,
  is_required boolean not null,
  position    integer not null
);

create index template_tasks_template_id_idx on public.template_tasks (template_id);
create index template_tasks_section_id_idx on public.template_tasks (section_id);

comment on table public.templates is
  'Шаблон процесу. У зрізі WS6 шаблони — довідкові дані з міграцій; екрана редагування немає.';

-- ── Запуски ─────────────────────────────────────────────────────────────────
create table public.runs (
  id             uuid primary key default gen_random_uuid(),
  -- Посилання лише для довідки: запуск не залежить від того, чи існує шаблон (AC-RUN-02).
  template_id    uuid references public.templates (id) on delete set null,
  template_name  text not null,
  case_name      text not null,
  run_manager_id uuid not null references public.profiles (id),
  status         text not null default 'in_progress',
  created_at     timestamptz not null default now(),
  constraint runs_status_check check (status in ('in_progress', 'completed')),
  -- Остання межа на випадок прямого запису: 1–100 символів, без пробільних символів на краях (AC-RUN-03, AC-RUN-07).
  constraint runs_case_name_check check (
    char_length(case_name) between 1 and 100 and case_name !~ '^\s' and case_name !~ '\s$'
  )
);

create index runs_run_manager_id_idx on public.runs (run_manager_id);

create table public.run_sections (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references public.runs (id) on delete cascade,
  name     text not null,
  position integer not null,
  constraint run_sections_position_key unique (run_id, position)
);

create table public.run_tasks (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs (id) on delete cascade,
  section_id  uuid not null references public.run_sections (id) on delete cascade,
  name        text not null,
  is_required boolean not null,
  position    integer not null,
  assignee_id uuid not null references public.profiles (id),
  status      text not null default 'to_do',
  constraint run_tasks_status_check check (status in ('to_do', 'done'))
);

create index run_tasks_run_id_idx on public.run_tasks (run_id);
create index run_tasks_assignee_id_idx on public.run_tasks (assignee_id);
create index run_tasks_section_id_idx on public.run_tasks (section_id);

comment on table public.runs is
  'Запуск шаблону для випадку. Змінюється лише функціями (launch_run); статуси in_progress / completed.';

-- ── RLS і права ─────────────────────────────────────────────────────────────
alter table public.templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks enable row level security;
alter table public.runs enable row level security;
alter table public.run_sections enable row level security;
alter table public.run_tasks enable row level security;

revoke all on table
  public.templates, public.template_sections, public.template_tasks,
  public.runs, public.run_sections, public.run_tasks
  from anon, authenticated;

-- Лише читання під політиками нижче; запис — тільки через функції.
grant select on table
  public.templates, public.template_sections, public.template_tasks,
  public.runs, public.run_sections, public.run_tasks
  to authenticated;

grant select, insert, update, delete on table
  public.templates, public.template_sections, public.template_tasks,
  public.runs, public.run_sections, public.run_tasks
  to service_role;

-- Хто бачить запуск: адміністратор, менеджер запуску, виконавець хоча б однієї задачі (AC-TASK-06,
-- «Видимість запусків»). security definer — щоб політики runs і run_tasks не посилались одна на одну (42P17).
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.runs as r
    where r.id = p_run_id
      and (
        (select private.current_app_role()) = 'admin'
        or r.run_manager_id = (select auth.uid())
        or exists (
          select 1 from public.run_tasks as t
          where t.run_id = r.id and t.assignee_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function private.can_see_run(uuid) from public, anon;
grant execute on function private.can_see_run(uuid) to authenticated;

-- Шаблони бачать усі користувачі застосунку (матриця прав: «See templates» — manager і admin).
create policy templates_select_all
  on public.templates for select to authenticated using (true);

create policy template_sections_select_all
  on public.template_sections for select to authenticated using (true);

create policy template_tasks_select_all
  on public.template_tasks for select to authenticated using (true);

create policy runs_select_visible
  on public.runs for select to authenticated using (private.can_see_run(id));

create policy run_sections_select_visible
  on public.run_sections for select to authenticated using (private.can_see_run(run_id));

create policy run_tasks_select_visible
  on public.run_tasks for select to authenticated using (private.can_see_run(run_id));

-- ── Довідник колег для вибору виконавця ─────────────────────────────────────
-- Менеджер не читає чужі профілі (RLS profiles), але має обрати виконавця (AC-RUN-04) і бачити, кому призначено задачу.
-- Повертаємо лише ім'я та email менеджерів і адміністраторів — без ролі (робоче рішення
-- solomchaak/property-workflows-spec#5).
create or replace function private.staff_directory()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email
  from public.profiles as p
  where (select private.current_app_role()) in ('manager', 'admin')
    and p.role in ('manager', 'admin')
  order by p.full_name nulls last, p.email;
$$;

revoke execute on function private.staff_directory() from public, anon;
grant execute on function private.staff_directory() to authenticated;

create or replace function public.staff_directory()
returns table (id uuid, full_name text, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.full_name, d.email from private.staff_directory() as d;
$$;

revoke execute on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

-- ── Запуск шаблону ──────────────────────────────────────────────────────────
-- p_assignments: {"<id задачі шаблону>": "<id профілю виконавця>"}. Задача без призначення → менеджер запуску
-- (AC-RUN-04, AC-RUN-08, AC-RUN-09). Ключі задач, яких у шаблоні вже немає, ігноруються (робоче рішення
-- solomchaak/property-workflows-spec#9). Помилки — коди в тексті винятку; текст для людини — у src/lib/runs/messages.ts.
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
  -- Пробільні символи на краях обрізаємо (робоче рішення solomchaak/property-workflows-spec#6).
  v_case_name     text := regexp_replace(coalesce(p_case_name, ''), '^\s+|\s+$', '', 'g');
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

  -- Виконавець — лише менеджер або адміністратор (requirements: «the assignee can only be a manager or an administrator»).
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, assignee_id)
    join public.template_tasks as tt on tt.id::text = a.task_id and tt.template_id = p_template_id
    left join public.profiles as p on p.id::text = a.assignee_id and p.role in ('manager', 'admin')
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
  left join jsonb_each_text(v_assignments) as a (task_id, assignee_id) on a.task_id = tt.id::text
  left join public.profiles as p on p.id::text = a.assignee_id
  where tt.template_id = p_template_id;

  return v_run_id;
end;
$$;

revoke execute on function private.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function private.launch_run(uuid, text, jsonb) to authenticated;

create or replace function public.launch_run(
  p_template_id uuid,
  p_case_name   text,
  p_assignments jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.launch_run(p_template_id, p_case_name, p_assignments);
$$;

revoke execute on function public.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function public.launch_run(uuid, text, jsonb) to authenticated;
