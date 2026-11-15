-- Правила шаблонів за рев'ю WS7 (koldovsky/2026-quitcode-07-fullstack-hw#5): три незалежні частини, одна міграція.
--
-- 1) Позначку незбережених змін (templates.has_unpublished_changes) читає лише адміністратор (AC-EDITOR-29: менеджер
--    «не отримує нічого, крім поточної версії»). Раніше grant select на всю таблицю давав менеджеру прямим запитом
--    дізнатися, що незбережені зміни існують. Колонкову позначку пишуть лише функції security definer і тригери
--    (save_template_version, тригери private.mark_unpublished), тож колонку не переносимо: забираємо право її читати, а
--    адміністратору віддаємо функцію з перевіркою ролі.
-- 2) Одне правило «порожньої назви» для застосунку й бази (AC-EDITOR-19, AC-EDITOR-23, AC-EDITOR-20): private.clean_name
--    обрізає той самий набір пробільних символів, що String.prototype.trim() у дії і regexp назви випадку в launch_run
--    (включно з U+00A0 і табуляцією). btrim() прибирав лише звичайний пробіл, тож прямим запитом можна було створити
--    назву з одного нерозривного пробілу або дублікат «Tenant move-in» з табуляцією в кінці.
-- 3) Позиція задачі унікальна в розділі (як у розділів у шаблоні): addTask рахує max + 1 окремим читанням, і два швидкі
--    додавання давали однакові позиції. Обмеження deferrable initially deferred: функції перестановки міняють позиції
--    двома операторами в одній транзакції, перевірка — під час commit.

-- ── 1. has_unpublished_changes — лише адміністратору ──────────────────────────────────────────────────────────────
revoke select on table public.templates from authenticated;
grant select (id, name, created_at, current_version) on table public.templates to authenticated;

create function private.templates_with_unpublished_changes()
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  -- Роль — у самому запиті: менеджер і вендор отримують порожній результат (AC-EDITOR-29).
  select t.id
  from public.templates as t
  where (select private.current_app_role()) = 'admin' and t.has_unpublished_changes;
$$;

revoke execute on function private.templates_with_unpublished_changes() from public, anon;
grant execute on function private.templates_with_unpublished_changes() to authenticated;

create function public.templates_with_unpublished_changes()
returns table (id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id from private.templates_with_unpublished_changes() as u;
$$;

revoke execute on function public.templates_with_unpublished_changes() from public, anon;
grant execute on function public.templates_with_unpublished_changes() to authenticated;

-- ── 2. Назви: один набір пробільних символів у застосунку й базі ─────────────────────────────────────────────────
create function private.clean_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_name, ''), '^[\s   -     　﻿]+|[\s   -     　﻿]+$', '', 'g');
$$;

revoke execute on function private.clean_name(text) from public, anon;
-- CHECK і вираз унікального індексу виконуються з правами того, хто пише: адміністратор (authenticated) і службові
-- скрипти й фікстури UAT (service_role). Функція чиста — лише текст, без доступу до даних.
grant usage on schema private to service_role;
grant execute on function private.clean_name(text) to authenticated, service_role;

-- Старі обмеження й індекс знімаємо першими: нормалізація наявних назв нижче могла б їх порушити (обрізаний край дає
-- дубль за старим ключем lower(btrim(name))).
alter table public.templates drop constraint templates_name_not_blank;
alter table public.template_draft_names drop constraint template_draft_names_name_not_blank;
drop index public.templates_name_normalized_key;

-- Наявні назви під нове правило (рев'ю CodeRabbit, PR #80; на проді й у сиді таких рядків немає — кроки на випадок, якщо
-- прямий запит колись записав назву з табуляцією чи U+00A0, яку btrim пропускав):
-- Порядок важливий: колонка name має ще й точний unique (templates_name_key), тож спершу розводимо збіги, а вже потім
-- обрізаємо краї (інакше «Tenant move-in» з табуляцією, обрізаний, зіткнувся б із наявним «Tenant move-in»).
-- а) збіг за новим ключем — усі шаблони групи, крім найстарішого, отримують очищену назву з початком id;
with ranked as (
  select id, row_number() over (partition by lower(private.clean_name(name)) order by created_at, id) as rn
  from public.templates
  where private.clean_name(name) <> ''
)
update public.templates as t
set name = private.clean_name(t.name) || ' (' || left(t.id::text, 8) || ')'
from ranked as r
where r.id = t.id and r.rn > 1;
-- б) назва шаблону лише з пробільних символів — заглушка з початком id (адміністратор перейменує в редакторі);
update public.templates set name = 'Untitled template ' || left(id::text, 8) where private.clean_name(name) = '';
-- в) пробільні символи на краях — тим самим набором, що clean_name (після а) кожен ключ унікальний);
update public.templates set name = private.clean_name(name) where name <> private.clean_name(name);
-- г) робоча назва: лише з пробільних символів — прибираємо (діє назва поточної версії, AC-EDITOR-21), інакше — краї.
delete from public.template_draft_names where private.clean_name(name) = '';
update public.template_draft_names set name = private.clean_name(name) where name <> private.clean_name(name);

alter table public.templates
  add constraint templates_name_not_blank check (char_length(private.clean_name(name)) > 0);
alter table public.template_draft_names
  add constraint template_draft_names_name_not_blank check (char_length(private.clean_name(name)) > 0);
create unique index templates_name_normalized_key on public.templates (lower(private.clean_name(name)));

-- Перевірки під час збереження версії — тим самим правилом (тіло — з 20261027225514, змінено лише btrim → clean_name).
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
  if exists (select 1 from public.template_sections as s where s.template_id = p_template_id and private.clean_name(s.name) = '')
     or exists (select 1 from public.template_tasks as tt where tt.template_id = p_template_id and private.clean_name(tt.name) = '') then
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
    where o.id <> p_template_id and lower(private.clean_name(o.name)) = lower(private.clean_name(v_name))
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

-- ── 3. Позиція задачі унікальна в розділі ─────────────────────────────────────────────────────────────────────────
-- Наявні дублікати (якщо два швидкі додавання вже їх дали) — у кінець розділу, решта рядків не змінюється (тригер
-- mark_unpublished позначить такий шаблон як змінений — це правда: порядок задач у ньому змінився).
-- Нумерація — у межах усього розділу (рев'ю CodeRabbit, PR #80): за позицій [1, 1, 2, 2] обидва зайві рядки отримують
-- різні нові позиції (3 і 4), а не однакову.
with ranked as (
  select id, section_id, position,
    row_number() over (partition by section_id, position order by id) as rn,
    max(position) over (partition by section_id) as max_position
  from public.template_tasks
),
duplicates as (
  select id, max_position + row_number() over (partition by section_id order by position, id) as new_position
  from ranked
  where rn > 1
)
update public.template_tasks as t
set position = d.new_position
from duplicates as d
where d.id = t.id;

alter table public.template_tasks
  add constraint template_tasks_section_position_key unique (section_id, position) deferrable initially deferred;
