-- Harden user creation against duplicate submits and race conditions.
-- 1) Normalize and enforce unique employee identity.
-- 2) Add idempotent RPC for create-user flow with request-level logging.

begin;

-- Ensure required helper columns exist in legacy environments.
alter table public.employees
  add column if not exists role text not null default 'employee';

alter table public.employees
  add column if not exists status text not null default 'active';

alter table public.employees
  add column if not exists updated_at timestamptz not null default now();

-- Normalize existing email values for consistent matching.
update public.employees
set email = lower(btrim(email))
where email is not null and email <> lower(btrim(email));

-- Collapse duplicate employee rows by normalized email.
-- Keep the most recently updated row and re-point transaction references.
with ranked as (
  select
    e.id,
    first_value(e.id) over (
      partition by lower(btrim(e.email))
      order by coalesce(e.updated_at, e.created_at, now()) desc, e.id desc
    ) as keeper_id,
    row_number() over (
      partition by lower(btrim(e.email))
      order by coalesce(e.updated_at, e.created_at, now()) desc, e.id desc
    ) as rn
  from public.employees e
  where e.email is not null and btrim(e.email) <> ''
),
duplicates as (
  select id, keeper_id
  from ranked
  where rn > 1
)
update public.transactions t
set employee_id = d.keeper_id
from duplicates d
where t.employee_id = d.id;

with ranked as (
  select
    e.id,
    row_number() over (
      partition by lower(btrim(e.email))
      order by coalesce(e.updated_at, e.created_at, now()) desc, e.id desc
    ) as rn
  from public.employees e
  where e.email is not null and btrim(e.email) <> ''
)
delete from public.employees e
using ranked r
where e.id = r.id and r.rn > 1;

create unique index if not exists idx_employees_email_unique_normalized
  on public.employees ((lower(btrim(email))))
  where email is not null and btrim(email) <> '';

create unique index if not exists idx_employees_user_id_unique
  on public.employees (user_id)
  where user_id is not null;

create table if not exists public.user_creation_logs (
  request_id uuid primary key,
  email text not null,
  user_id uuid,
  employee_id uuid,
  actor_user_id uuid,
  action_status text not null,
  detail text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_creation_logs_employee_id_fkey'
      and conrelid = 'public.user_creation_logs'::regclass
  ) then
    alter table public.user_creation_logs
      add constraint user_creation_logs_employee_id_fkey
      foreign key (employee_id)
      references public.employees(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_user_creation_logs_email on public.user_creation_logs ((lower(btrim(email))));
create index if not exists idx_user_creation_logs_created_at on public.user_creation_logs (created_at desc);

create or replace function public.create_employee_idempotent(
  arg_request_id uuid,
  arg_user_id uuid,
  arg_email text,
  arg_name text,
  arg_tel text default null,
  arg_department_id uuid default null,
  arg_status text default 'active',
  arg_role text default 'employee'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text;
  normalized_name text;
  normalized_tel text;
  normalized_role text;
  normalized_status text;
  target_employee public.employees%rowtype;
  existing_log public.user_creation_logs%rowtype;
begin
  if arg_request_id is null then
    raise exception using errcode = '22023', message = 'request_id is required';
  end if;

  normalized_email := lower(btrim(coalesce(arg_email, '')));
  normalized_name := btrim(coalesce(arg_name, ''));
  normalized_tel := nullif(btrim(coalesce(arg_tel, '')), '');
  normalized_role := lower(btrim(coalesce(arg_role, 'employee')));
  normalized_status := lower(btrim(coalesce(arg_status, 'active')));

  if normalized_email = '' then
    raise exception using errcode = '22023', message = 'email is required';
  end if;

  if normalized_name = '' then
    raise exception using errcode = '22023', message = 'name is required';
  end if;

  if normalized_role not in ('admin', 'employee') then
    normalized_role := 'employee';
  end if;

  if normalized_status not in ('active', 'inactive') then
    normalized_status := 'active';
  end if;

  if not (
    coalesce((auth.jwt() ->> 'role') = 'service_role', false)
    or coalesce(public.is_admin_user(), false)
  ) then
    raise insufficient_privilege using message = 'You do not have permission to create users';
  end if;

  select *
  into existing_log
  from public.user_creation_logs
  where request_id = arg_request_id;

  if found then
    if existing_log.employee_id is not null then
      select *
      into target_employee
      from public.employees
      where id = existing_log.employee_id
      limit 1;
    end if;

    if target_employee.id is null then
      select *
      into target_employee
      from public.employees
      where lower(btrim(email)) = normalized_email
      order by coalesce(updated_at, created_at, now()) desc, id desc
      limit 1;
    end if;

    return jsonb_build_object(
      'request_id', arg_request_id,
      'employee_id', target_employee.id,
      'user_id', coalesce(target_employee.user_id, arg_user_id),
      'email', normalized_email,
      'created', false,
      'replayed', true
    );
  end if;

  select *
  into target_employee
  from public.employees
  where lower(btrim(email)) = normalized_email
  order by coalesce(updated_at, created_at, now()) desc, id desc
  limit 1
  for update;

  if found then
    update public.employees
    set
      user_id = coalesce(target_employee.user_id, arg_user_id),
      name = normalized_name,
      tel = coalesce(normalized_tel, target_employee.tel),
      department_id = coalesce(arg_department_id, target_employee.department_id),
      role = coalesce(normalized_role, target_employee.role),
      status = coalesce(normalized_status, target_employee.status),
      email = normalized_email,
      updated_at = now()
    where id = target_employee.id
    returning * into target_employee;

    insert into public.user_creation_logs (
      request_id,
      email,
      user_id,
      employee_id,
      actor_user_id,
      action_status,
      detail
    )
    values (
      arg_request_id,
      normalized_email,
      coalesce(target_employee.user_id, arg_user_id),
      target_employee.id,
      auth.uid(),
      'existing_updated',
      'request reused existing employee row'
    )
    on conflict (request_id) do nothing;

    return jsonb_build_object(
      'request_id', arg_request_id,
      'employee_id', target_employee.id,
      'user_id', coalesce(target_employee.user_id, arg_user_id),
      'email', normalized_email,
      'created', false,
      'replayed', false
    );
  end if;

  insert into public.employees (
    user_id,
    name,
    email,
    tel,
    department_id,
    role,
    status
  )
  values (
    arg_user_id,
    normalized_name,
    normalized_email,
    normalized_tel,
    arg_department_id,
    normalized_role,
    normalized_status
  )
  returning * into target_employee;

  insert into public.user_creation_logs (
    request_id,
    email,
    user_id,
    employee_id,
    actor_user_id,
    action_status,
    detail
  )
  values (
    arg_request_id,
    normalized_email,
    coalesce(target_employee.user_id, arg_user_id),
    target_employee.id,
    auth.uid(),
    'created',
    'created new employee row'
  )
  on conflict (request_id) do nothing;

  return jsonb_build_object(
    'request_id', arg_request_id,
    'employee_id', target_employee.id,
    'user_id', coalesce(target_employee.user_id, arg_user_id),
    'email', normalized_email,
    'created', true,
    'replayed', false
  );
exception
  when unique_violation then
    select *
    into target_employee
    from public.employees
    where lower(btrim(email)) = normalized_email
    order by coalesce(updated_at, created_at, now()) desc, id desc
    limit 1;

    if target_employee.id is not null then
      insert into public.user_creation_logs (
        request_id,
        email,
        user_id,
        employee_id,
        actor_user_id,
        action_status,
        detail
      )
      values (
        arg_request_id,
        normalized_email,
        coalesce(target_employee.user_id, arg_user_id),
        target_employee.id,
        auth.uid(),
        'race_recovered',
        'handled unique conflict by using existing employee row'
      )
      on conflict (request_id) do nothing;

      return jsonb_build_object(
        'request_id', arg_request_id,
        'employee_id', target_employee.id,
        'user_id', coalesce(target_employee.user_id, arg_user_id),
        'email', normalized_email,
        'created', false,
        'replayed', false,
        'race_recovered', true
      );
    end if;

    raise;
end;
$$;

grant execute on function public.create_employee_idempotent(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text
) to authenticated;

commit;
