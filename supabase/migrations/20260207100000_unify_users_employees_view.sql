-- Unify employee/user reads via a single view and tighten employees RLS.
-- This migration keeps employees as the mutation source of truth.

-- Ensure user_roles exists for optional role join in the unified view.
create table if not exists public.user_roles (
  user_id uuid primary key,
  role text not null default 'viewer',
  created_at timestamptz default now()
);

-- Admin helper used by RLS policies.
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.role = 'admin'
      and coalesce(e.status, 'active') = 'active'
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

alter table public.employees enable row level security;

-- Drop permissive legacy policies.
drop policy if exists "Allow public read employees" on public.employees;
drop policy if exists "Allow public insert employees" on public.employees;
drop policy if exists "Allow public update employees" on public.employees;
drop policy if exists "Allow public delete employees" on public.employees;
drop policy if exists employees_admin_update on public.employees;

-- Admins can manage all employee rows; non-admin users can read only their own row.
create policy employees_select_admin_or_self
  on public.employees
  for select
  to authenticated
  using (public.is_admin_user() or user_id = auth.uid());

create policy employees_insert_admin
  on public.employees
  for insert
  to authenticated
  with check (public.is_admin_user());

create policy employees_update_admin
  on public.employees
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy employees_delete_admin
  on public.employees
  for delete
  to authenticated
  using (public.is_admin_user());

-- Unified read model for both Employees and Users pages.
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
