-- Рев'ю безпеки й архітектури (2026-11-17), одна міграція для трьох пов'язаних із даними знахідок:
--   1) ліміт запитів до моделі («Propose values», AC-DOCAI-13): без нього один менеджер скриптом вичерпує денну квоту
--      безкоштовних запитів (50 на ключ) для всіх — таблиця ai_requests і функція take_ai_request;
--   5) розмір run_document_values.fields обмежено;
--   8) зміна email у Auth оновлює profiles.email (раніше копія робилася лише при створенні користувача).
-- Застосована міграція 20261116092131_run_document_values.sql не змінюється — обмеження додаємо новим файлом.

-- ── 1) Облік запитів до моделі ───────────────────────────────────────────────
-- Рядок = один дозволений запит до моделі. Пишуть лише функція нижче (security definer) і service_role; клієнтам
-- (anon, authenticated) таблиця недоступна зовсім: прав немає, політик немає — RLS забороняє все.
create table public.ai_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_requests_user_id_created_at_idx on public.ai_requests (user_id, created_at desc);
create index ai_requests_created_at_idx on public.ai_requests (created_at);

comment on table public.ai_requests is
  'Дозволені запити до моделі (ліміт «Propose values», AC-DOCAI-13). Пише лише private.take_ai_request(); рядки старші за добу видаляє вона ж.';

alter table public.ai_requests enable row level security;

revoke all on table public.ai_requests from anon, authenticated;
grant select, insert, update, delete on table public.ai_requests to service_role;

-- Атомарно рахує запити користувача за останню годину й усього застосунку за добу і, якщо ліміти не вичерпано,
-- записує новий запит. Повертає: 'allowed' | 'user_limit' | 'app_limit' | 'not_allowed' (немає входу чи ролі
-- manager / admin). Межі — константи нижче: 10 на годину на користувача, 40 на добу на застосунок (квота ключа — 50:
-- запас лишається на ручні запуски eval / uat). Глобальний advisory lock на час транзакції серіалізує перевірки: без
-- нього два одночасні виклики обидва побачили б «лишилось 1» і обидва пройшли б. Викликач бачить лише відповідь і
-- додає рядок лише від свого імені (user_id = auth.uid()); чужих рядків не читає й не пише.
create or replace function private.take_ai_request()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_user_per_hour constant integer := 10;
  c_app_per_day   constant integer := 40;
  v_user uuid := (select auth.uid());
  v_role text := (select private.current_app_role());
begin
  if v_user is null or coalesce(v_role, '') not in ('manager', 'admin') then
    return 'not_allowed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('private.take_ai_request', 0));

  delete from public.ai_requests where created_at < now() - interval '24 hours';

  if (select count(*) from public.ai_requests
      where user_id = v_user and created_at > now() - interval '1 hour') >= c_user_per_hour then
    return 'user_limit';
  end if;
  if (select count(*) from public.ai_requests
      where created_at > now() - interval '24 hours') >= c_app_per_day then
    return 'app_limit';
  end if;

  insert into public.ai_requests (user_id) values (v_user);
  return 'allowed';
end;
$$;

revoke execute on function private.take_ai_request() from public, anon;
grant execute on function private.take_ai_request() to authenticated;

-- Тонка обгортка для supabase.rpc('take_ai_request'): схема private поза Data API.
create or replace function public.take_ai_request()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.take_ai_request();
$$;

revoke execute on function public.take_ai_request() from public, anon;
grant execute on function public.take_ai_request() to authenticated;

-- ── 5) Розмір підтверджених значень ──────────────────────────────────────────
-- Найбільший кошторис, який пропускає форма (50 позицій по 200 символів і 7 приміток, src/lib/documents/values.ts),
-- займає 15 378 байт для ASCII і 26 578 для кирилиці (виміряно pg_column_size), тож межа 16 КБ відхиляла б валідні дані:
-- беремо 32 КБ. Обмеження лише не дає прямому запиту з публічним ключем записати довільно великий jsonb.
alter table public.run_document_values
  add constraint run_document_values_fields_size_check check (pg_catalog.pg_column_size(fields) < 32768);

-- ── 8) profiles.email слідом за auth.users.email ─────────────────────────────
-- Спершу вирівнюємо вже розбіжні рядки, далі тригер тримає їх узгодженими. Оновлює лише рядок цього користувача
-- (id = new.id); функцію не викликають клієнти (execute знято), її запускає тільки тригер.
update public.profiles as p
   set email = u.email
  from auth.users as u
 where u.id = p.id
   and p.email is distinct from u.email;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id
     and email is distinct from new.email;
  return new;
end;
$$;

revoke execute on function private.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
