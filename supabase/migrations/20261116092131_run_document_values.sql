-- Підтверджені значення документа в запуску (зріз 4, openspec/specs/document-parsing; план
-- openspec/changes/impl-document-parsing/design.md, «Дані й RLS»). Модель лише пропонує значення й нічого не пише:
-- рядок тут з'являється тільки після «Save values» — явної дії людини (AC-DOCAI-08). Хто розбирає документ і зберігає
-- значення — адміністратор і менеджер запуску (варіант A solomchaak/property-workflows-spec#53, тимчасово до відповіді
-- PM); вендор і виконавець, що не є менеджером запуску, цих рядків не читають і не пишуть.
-- Рядок незмінний: update і delete немає (запис підтвердження). Видаляється лише разом із запуском (on delete cascade).

create table public.run_document_values (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.runs (id) on delete cascade,
  kind         text not null,
  -- Значення, які підтвердила людина (звернення: phone, description, category, urgency, notes; кошторис: items,
  -- total, warning, notes). Форму значень перевіряє Server Action (zod, src/lib/documents/values.ts).
  fields       jsonb not null,
  -- Хто підтвердив і коли — ставить база, користувач їх не задає (колонкового grant на них немає).
  confirmed_by uuid not null default auth.uid() references public.profiles (id),
  confirmed_at timestamptz not null default now(),
  constraint run_document_values_kind_check check (kind in ('request', 'estimate')),
  constraint run_document_values_fields_check check (jsonb_typeof(fields) = 'object')
);

create index run_document_values_run_id_idx on public.run_document_values (run_id, confirmed_at desc);
create index run_document_values_confirmed_by_idx on public.run_document_values (confirmed_by);

comment on table public.run_document_values is
  'Значення документа (звернення чи кошторис), підтверджені людиною в запуску (AC-DOCAI-08). Лише insert і select.';

alter table public.run_document_values enable row level security;

revoke all on table public.run_document_values from anon, authenticated;
grant select on table public.run_document_values to authenticated;
grant insert (run_id, kind, fields) on table public.run_document_values to authenticated;
grant select, insert, update, delete on table public.run_document_values to service_role;

-- Хто працює зі значеннями документа запуску: адміністратор або менеджер цього запуску (і роль — manager чи admin:
-- вендор не стає менеджером запуску, але правило не покладається на це). security definer — щоб політика не залежала
-- від політик runs; викликач бачить лише відповідь «так / ні» для конкретного запуску.
create or replace function private.can_manage_run_documents(p_run_id uuid)
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
        or (
          (select private.current_app_role()) = 'manager'
          and r.run_manager_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function private.can_manage_run_documents(uuid) from public, anon;
grant execute on function private.can_manage_run_documents(uuid) to authenticated;

create policy run_document_values_select_managers
  on public.run_document_values for select to authenticated
  using (private.can_manage_run_documents(run_id));

create policy run_document_values_insert_managers
  on public.run_document_values for insert to authenticated
  with check (
    confirmed_by = (select auth.uid())
    and private.can_manage_run_documents(run_id)
  );
