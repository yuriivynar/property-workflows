-- UI v3, рішення власника 2026-11-26 (ADR 0012; поза вимогами PM, тому без AC):
-- 1) run_events — журнал подій запуску «хто, що, коли» без вільного тексту: запуск, позначка задачі, відповідь на поле.
--    Пишуть лише тригери (security definer у private); читають ті, хто бачить запуск, крім вендора (як run_fields).
-- 2) Живі оновлення: run_events, run_tasks, run_fields — у публікації supabase_realtime (postgres_changes; діє RLS
--    того, хто підписався). У тестовій базі без Realtime публікації немає — блок пропускається.
-- 3) Фото профілю: profiles.avatar_url (шлях об'єкта у своїй теці бакета avatars, колонковий grant update), приватний
--    бакет avatars (PNG/JPG до 2 МБ), кожен читає й пише лише свою теку <uid>/… — чужого фото не показуємо
--    (AC-RUN-10, AC-TASK-11, AC-VENDOR-02/18 — лише email). Без схеми storage (тестова база) — блок пропускається.

-- ── 1. Журнал подій запуску ─────────────────────────────────────────────────
create table public.run_events (
  id         bigint generated always as identity primary key,
  run_id     uuid not null references public.runs (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null,
  task_id    uuid references public.run_tasks (id) on delete cascade,
  field_id   uuid references public.run_fields (id) on delete cascade,
  -- Відповідь — лише одна з фіксованих відповідей поля (run_fields_answer_check) або null («без відповіді»).
  answer     text,
  created_at timestamptz not null default now(),
  constraint run_events_kind_check check (kind in ('launched', 'task_done', 'answer_set')),
  constraint run_events_shape_check check (
    (kind = 'launched' and task_id is null and field_id is null and answer is null)
    or (kind = 'task_done' and task_id is not null and field_id is null and answer is null)
    or (kind = 'answer_set' and task_id is null and field_id is not null)
  )
);

create index run_events_run_id_created_at_idx on public.run_events (run_id, created_at desc);
create index run_events_actor_id_created_at_idx on public.run_events (actor_id, created_at desc);

comment on table public.run_events is
  'Події запуску (хто, що, коли) для стрічки Activity і «Done this week». Пишуть лише тригери; без вільного тексту.';

alter table public.run_events enable row level security;
revoke all on table public.run_events from anon, authenticated;
grant select on table public.run_events to authenticated;
grant select, insert, update, delete on table public.run_events to service_role;

-- Стрічку бачать ті, хто бачить запуск, крім вендора (вендор не бачить відповідей і чужих задач). Власні події
-- «task_done» — і вендору: для «Done this week» на його Profile.
create policy run_events_select_visible
  on public.run_events for select to authenticated
  using (
    (private.can_see_run(run_id) and (select private.current_app_role()) is distinct from 'vendor')
    or (kind = 'task_done' and actor_id = (select auth.uid()))
  );

-- Тригери: security definer, бо в authenticated немає insert на run_events (подію не підробити прямим запитом).
-- Умови AGENTS.md: схема private, search_path = '', revoke execute від усіх (тригер не викликається напряму); перевірку
-- доступу вже зробили запис у runs / run_tasks / run_fields (launch_run, mark_task_done, set_run_field_answer).
create or replace function private.log_run_launched()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.run_events (run_id, actor_id, kind) values (new.id, (select auth.uid()), 'launched');
  return null;
end;
$$;

create or replace function private.log_task_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    insert into public.run_events (run_id, actor_id, kind, task_id) values (new.run_id, (select auth.uid()), 'task_done', new.id);
  end if;
  return null;
end;
$$;

create or replace function private.log_answer_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.answer is distinct from old.answer then
    insert into public.run_events (run_id, actor_id, kind, field_id, answer)
    values (new.run_id, (select auth.uid()), 'answer_set', new.id, new.answer);
  end if;
  return null;
end;
$$;

revoke execute on function private.log_run_launched() from public, anon, authenticated;
revoke execute on function private.log_task_done() from public, anon, authenticated;
revoke execute on function private.log_answer_set() from public, anon, authenticated;

create trigger runs_log_launched
  after insert on public.runs
  for each row execute function private.log_run_launched();

create trigger run_tasks_log_done
  after update of status on public.run_tasks
  for each row execute function private.log_task_done();

create trigger run_fields_log_answer
  after update of answer on public.run_fields
  for each row execute function private.log_answer_set();

-- ── 2. Живі оновлення (Supabase Realtime) ───────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.run_events, public.run_tasks, public.run_fields;
  end if;
end;
$$;

-- ── 3. Фото профілю ─────────────────────────────────────────────────────────
alter table public.profiles
  add column avatar_url text,
  -- Лише об'єкт у власній теці: «<id>/…» (чужий шлях записати не можна).
  add constraint profiles_avatar_url_own_folder check (avatar_url is null or avatar_url like id::text || '/%');

-- Колонковий grant: користувач змінює лише full_name і avatar_url, а не role (політика profiles_update_own — свій рядок).
grant update (avatar_url) on table public.profiles to authenticated;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg'])
  on conflict (id) do nothing;

  -- Кожна операція — лише в теці «<auth.uid()>/» бакета avatars: чужого фото не прочитати й не змінити.
  execute $p$
    create policy avatars_select_own on storage.objects for select to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy avatars_insert_own on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy avatars_update_own on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy avatars_delete_own on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end;
$$;
