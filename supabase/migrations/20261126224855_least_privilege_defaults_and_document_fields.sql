-- Поради викладача курсу, що лишались відкритими на main (рев'ю WS7–WS10; рішення власника 2026-11-27):
-- 1) Роль за замовчуванням — найменші права. Профіль, якому роль не призначили явно (новий акаунт до дії
--    адміністратора), досі отримував 'manager' і міг запускати шаблони й бачити колег. Тепер — 'vendor': бачить лише
--    власні задачі (AC-VENDOR-*). Наявні профілі не змінюються: у кожного роль уже стоїть явно (users:demo,
--    supabase/demo-users.json, ставить роль явно). Перелік ролей не змінюється, тож profiles_role_check лишається.
-- 2) Підтверджені значення документа (run_document_values.fields) база перевіряє так само, як zod у Server Action
--    (src/lib/documents/values.ts): прямий insert під сесією того самого менеджера не обійде форму значень (AC-DOCAI-08).
--    Обмеження NOT VALID: наявні рядки (усі записано через zod) не перевіряються заднім числом, кожен новий — так.

-- ── 1. Роль за замовчуванням ─────────────────────────────────────────────────
alter table public.profiles alter column role set default 'vendor';

-- ── 2. Форма підтверджених значень документа ─────────────────────────────────
-- Чиста функція без доступу до таблиць: security invoker (за замовчуванням), immutable, search_path порожній.
create or replace function private.is_short_text(p_value jsonb, p_min integer, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_value) = 'string' then pg_catalog.char_length(p_value #>> '{}') between p_min and p_max
    else false
  end;
$$;

create or replace function private.is_number_between(p_value jsonb, p_min numeric, p_max numeric, p_strict_min boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- case гарантує порядок: приведення до numeric — лише для числа JSON (and у SQL порядку не гарантує).
  select case
    when pg_catalog.jsonb_typeof(p_value) = 'number' then
      (p_value #>> '{}')::numeric <= p_max
      and case when p_strict_min then (p_value #>> '{}')::numeric > p_min else (p_value #>> '{}')::numeric >= p_min end
    else false
  end;
$$;

-- Примітки: до 7 непорожніх рядків до 200 символів (NotesSchema).
create or replace function private.document_notes_valid(p_notes jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_notes) = 'array' then
      pg_catalog.jsonb_array_length(p_notes) <= 7
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements(p_notes) as note
        where not private.is_short_text(note, 1, 200)
      )
    else false
  end;
$$;

-- Позиція кошторису: рівно name (1–200), quantity (> 0, ≤ 1 000 000), unitPrice (≥ 0, ≤ 100 000 000) — ItemSchema.
create or replace function private.document_item_valid(p_item jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_item) = 'object' then
      coalesce((select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_item) as k)
        = array['name', 'quantity', 'unitPrice'], false)
      and private.is_short_text(p_item -> 'name', 1, 200)
      and private.is_number_between(p_item -> 'quantity', 0, 1000000, true)
      and private.is_number_between(p_item -> 'unitPrice', 0, 100000000, false)
    else false
  end;
$$;

-- Значення за видом документа — ті самі ключі й межі, що RequestValuesSchema / EstimateValuesSchema + поля коду
-- (телефон у формі, попередження про суму; toStoredValues). Зайвий чи відсутній ключ — false.
create or replace function private.document_fields_valid(p_kind text, p_fields jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- coalesce: CHECK пропускає NULL, тож будь-яка невизначеність (порожній об'єкт, відсутній ключ) — це false.
  select coalesce(pg_catalog.jsonb_typeof(p_fields) = 'object'
     and case p_kind
       when 'request' then
         (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_fields) as k)
           = array['category', 'description', 'notes', 'phone', 'urgency']
         and (p_fields -> 'phone' = 'null'::jsonb or private.is_short_text(p_fields -> 'phone', 1, 40))
         and private.is_short_text(p_fields -> 'description', 1, 500)
         and (p_fields ->> 'category') in
           ('plumbing', 'electrical', 'heating and cooling', 'appliance', 'structure and doors', 'other')
         and pg_catalog.jsonb_typeof(p_fields -> 'category') = 'string'
         and (p_fields ->> 'urgency') in ('urgent', 'not urgent')
         and pg_catalog.jsonb_typeof(p_fields -> 'urgency') = 'string'
         and private.document_notes_valid(p_fields -> 'notes')
       when 'estimate' then
         (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_fields) as k)
           = array['items', 'notes', 'total', 'warning']
         and pg_catalog.jsonb_typeof(p_fields -> 'items') = 'array'
         and pg_catalog.jsonb_array_length(p_fields -> 'items') between 1 and 50
         and not exists (
           select 1 from pg_catalog.jsonb_array_elements(p_fields -> 'items') as item
           where not private.document_item_valid(item)
         )
         and (p_fields -> 'total' = 'null'::jsonb or private.is_number_between(p_fields -> 'total', 0, 100000000, false))
         and (p_fields -> 'warning' = 'null'::jsonb or private.is_short_text(p_fields -> 'warning', 1, 200))
         and private.document_notes_valid(p_fields -> 'notes')
       else false
     end, false);
$$;

-- Функції викликає лише перевірка таблиці; напряму — нікому (не security definer, але й не публічний API).
revoke execute on function private.is_short_text(jsonb, integer, integer) from public, anon;
revoke execute on function private.is_number_between(jsonb, numeric, numeric, boolean) from public, anon;
revoke execute on function private.document_notes_valid(jsonb) from public, anon;
revoke execute on function private.document_item_valid(jsonb) from public, anon;
revoke execute on function private.document_fields_valid(text, jsonb) from public, anon;
grant execute on function private.is_short_text(jsonb, integer, integer) to authenticated, service_role;
grant execute on function private.is_number_between(jsonb, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function private.document_notes_valid(jsonb) to authenticated, service_role;
grant execute on function private.document_item_valid(jsonb) to authenticated, service_role;
grant execute on function private.document_fields_valid(text, jsonb) to authenticated, service_role;

alter table public.run_document_values
  add constraint run_document_values_shape_check check (private.document_fields_valid(kind, fields)) not valid;
