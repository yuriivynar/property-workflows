-- Ролі першого зрізу: manager і admin замість member і admin шаблону
-- (requirements/product.md, «Користувачі й ролі»; openspec/changes/impl-workflow-runs/design.md, рішення 1).
--
-- Порядок важливий (README шаблону, «Нові ролі»):
--   0) старий constraint знімаємо першим: він не пропустить UPDATE на нову роль (23514);
--   1) наявні дані: users:demo уже створив профілі з role = 'member';
--   2) default колонки: тригер on_auth_user_created вставляє профіль із default-роллю;
--   3) лише тепер — новий constraint.

alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'manager' where role = 'member';

alter table public.profiles alter column role set default 'manager';

alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'admin'));
