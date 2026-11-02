-- Дані для e2e в CI (.github/workflows/e2e.yml): одноразова локальна база, яку вже заповнили міграції й seed.sql.
-- «Дано» AC-EDITOR-07: у шаблону «Tenant move-in» версії 1 і 2. На проді версію 2 зберіг адміністратор у редакторі;
-- тут — так само, як її пише private.save_template_version: знімок шаблону новою версією, вона стає поточною.
-- Не в seed.sql: його читають і тести бази (tests/db/supabase-pglite.ts), що чекають на «Tenant move-in» версії 1.
-- Ідемпотентно: повторний запуск нічого не дублює.

insert into public.template_versions (template_id, number, content, created_by)
select t.id, 2, private.template_snapshot(t.id) || jsonb_build_object('name', t.name), null
from public.templates as t
where t.id = '10000000-0000-4000-8000-000000000001'
  and not exists (
    select 1 from public.template_versions as v where v.template_id = t.id and v.number = 2
  );

update public.templates
set current_version = 2, has_unpublished_changes = false
where id = '10000000-0000-4000-8000-000000000001' and current_version = 1;
