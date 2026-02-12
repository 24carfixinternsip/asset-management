-- Ensure user list returns one row per employee/user even when user_roles has duplicates.
-- Safe to rerun in existing environments.

begin;

create table if not exists public.user_roles (
  user_id uuid not null,
  role text not null default 'viewer',
  created_at timestamptz default now()
);

update public.user_roles
set role = lower(btrim(role))
where role is not null;

delete from public.user_roles
where user_id is null
   or role is null
   or btrim(role) = '';

with ranked as (
  select
    ctid,
    row_number() over (
      partition by user_id, role
      order by created_at desc nulls last, ctid desc
    ) as rn
  from public.user_roles
)
delete from public.user_roles ur
using ranked r
where ur.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists idx_user_roles_user_role_unique
  on public.user_roles (user_id, role);

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
    when lower(coalesce(e.role, '')) = 'admin' or ur_agg.role = 'admin' then 'admin'
    else 'employee'
  end as role,
  e.role as employee_role,
  ur_agg.role as account_role,
  e.image_url,
  e.created_at,
  e.updated_at
from public.employees e
left join public.departments d
  on d.id = e.department_id
left join public.locations l
  on l.id = e.location_id
left join lateral (
  select
    case
      when bool_or(lower(btrim(ur.role)) = 'admin') then 'admin'
      when bool_or(lower(btrim(ur.role)) = 'employee') then 'employee'
      else min(lower(btrim(ur.role)))
    end as role
  from public.user_roles ur
  where ur.user_id = e.user_id
) ur_agg on true;

grant select on public.view_users_full to authenticated;
grant select on public.view_users_full to anon;

commit;
