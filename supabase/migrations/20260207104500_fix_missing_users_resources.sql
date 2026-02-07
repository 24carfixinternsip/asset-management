-- Fix missing resources that caused 404 on:
-- - /rest/v1/view_users_full
-- - /rest/v1/navigation_groups
-- Keep all statements idempotent so it is safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key,
  role text not null default 'viewer',
  created_at timestamptz default now()
);

create table if not exists public.navigation_groups (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  is_core boolean not null default false,
  created_at timestamptz default now()
);

do $$
declare
  nav_group_id_type text;
  nav_item_group_id_type text;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into nav_group_id_type
  from pg_attribute a
  where a.attrelid = 'public.navigation_groups'::regclass
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if nav_group_id_type is null then
    nav_group_id_type := 'uuid';
  end if;

  if to_regclass('public.navigation_items') is null then
    execute format(
      'create table public.navigation_items (
        id uuid primary key default gen_random_uuid(),
        group_id %s,
        label text not null,
        path text not null,
        icon text,
        order_index integer not null default 0,
        is_visible boolean not null default true,
        roles text[] not null default ''{admin,viewer}'',
        is_core boolean not null default false,
        created_at timestamptz default now(),
        constraint navigation_items_group_id_fkey foreign key (group_id)
          references public.navigation_groups(id) on delete cascade
      )',
      nav_group_id_type
    );
  else
    select pg_catalog.format_type(a.atttypid, a.atttypmod)
      into nav_item_group_id_type
    from pg_attribute a
    where a.attrelid = 'public.navigation_items'::regclass
      and a.attname = 'group_id'
      and a.attnum > 0
      and not a.attisdropped;

    if nav_item_group_id_type is distinct from nav_group_id_type then
      execute 'alter table public.navigation_items drop constraint if exists navigation_items_group_id_fkey';

      if nav_group_id_type = 'uuid' then
        execute $sql$
          alter table public.navigation_items
          alter column group_id type uuid
          using case
            when group_id is null then null
            when group_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then group_id::text::uuid
            else null
          end
        $sql$;
      elsif nav_group_id_type = 'bigint' then
        execute $sql$
          alter table public.navigation_items
          alter column group_id type bigint
          using case
            when group_id is null then null
            when group_id::text ~ '^-?\d+$' then group_id::text::bigint
            else null
          end
        $sql$;
      elsif nav_group_id_type = 'integer' then
        execute $sql$
          alter table public.navigation_items
          alter column group_id type integer
          using case
            when group_id is null then null
            when group_id::text ~ '^-?\d+$' then group_id::text::integer
            else null
          end
        $sql$;
      end if;
    end if;

    execute 'alter table public.navigation_items drop constraint if exists navigation_items_group_id_fkey';
    execute 'alter table public.navigation_items add constraint navigation_items_group_id_fkey foreign key (group_id) references public.navigation_groups(id) on delete cascade';
  end if;
end $$;

create index if not exists idx_navigation_groups_order on public.navigation_groups(order_index);
create index if not exists idx_navigation_items_group on public.navigation_items(group_id);
create index if not exists idx_navigation_items_order on public.navigation_items(order_index);

alter table public.navigation_groups enable row level security;
alter table public.navigation_items enable row level security;

drop policy if exists navigation_groups_select_authenticated on public.navigation_groups;
create policy navigation_groups_select_authenticated
  on public.navigation_groups
  for select
  to authenticated
  using (true);

drop policy if exists navigation_items_select_authenticated on public.navigation_items;
create policy navigation_items_select_authenticated
  on public.navigation_items
  for select
  to authenticated
  using (true);

grant select on public.navigation_groups to authenticated;
grant select on public.navigation_items to authenticated;
grant select on public.navigation_groups to anon;
grant select on public.navigation_items to anon;

insert into public.navigation_groups (label, icon, order_index, is_active, is_core)
select 'Main', 'LayoutGrid', 0, true, true
where not exists (select 1 from public.navigation_groups);

with first_group as (
  select id
  from public.navigation_groups
  order by order_index asc, created_at asc
  limit 1
)
insert into public.navigation_items (group_id, label, path, icon, order_index, is_visible, roles, is_core)
select g.id, 'Dashboard', '/dashboard', 'LayoutDashboard', 10, true, array['admin','viewer']::text[], true
from first_group g
where not exists (select 1 from public.navigation_items where path = '/dashboard');

with first_group as (
  select id
  from public.navigation_groups
  order by order_index asc, created_at asc
  limit 1
)
insert into public.navigation_items (group_id, label, path, icon, order_index, is_visible, roles, is_core)
select g.id, 'Employees', '/employees', 'Users', 20, true, array['admin']::text[], true
from first_group g
where not exists (select 1 from public.navigation_items where path = '/employees');

with first_group as (
  select id
  from public.navigation_groups
  order by order_index asc, created_at asc
  limit 1
)
insert into public.navigation_items (group_id, label, path, icon, order_index, is_visible, roles, is_core)
select g.id, 'Users', '/users', 'Shield', 30, true, array['admin']::text[], true
from first_group g
where not exists (select 1 from public.navigation_items where path = '/users');

create or replace view public.view_users_full
with (security_invoker = true)
as
select
  e.id,
  e.user_id,
  e.emp_code,
  e.name,
  e.nickname,
  e.gender,
  e.email,
  e.tel,
  e.department_id,
  d.name as department_name,
  e.location_id,
  l.name as location_name,
  e.status,
  case
    when e.role = 'admin' or ur.role = 'admin' then 'admin'
    else 'employee'
  end as role,
  e.role as employee_role,
  ur.role as account_role,
  e.image_url,
  e.created_at,
  e.updated_at
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.locations l on l.id = e.location_id
left join public.user_roles ur on ur.user_id = e.user_id;

grant select on public.view_users_full to authenticated;
grant select on public.view_users_full to anon;
