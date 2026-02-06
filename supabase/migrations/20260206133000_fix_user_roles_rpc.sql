-- Ensure employees schema supports canonical role column and safe role updates.

-- 1) Columns (idempotent)
alter table public.employees
  add column if not exists user_id uuid;

alter table public.employees
  add column if not exists role text not null default 'employee';

alter table public.employees
  add column if not exists updated_at timestamptz not null default now();

-- Ensure defaults + NOT NULL in case columns existed without them.
alter table public.employees
  alter column role set default 'employee';

update public.employees
set role = 'employee'
where role is null;

alter table public.employees
  alter column role set not null;

alter table public.employees
  alter column updated_at set default now();

update public.employees
set updated_at = now()
where updated_at is null;

alter table public.employees
  alter column updated_at set not null;

-- 2) Constrain role values
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_role_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_role_check
      check (role in ('employee', 'admin'));
  end if;
end $$;

-- 3) Index on user_id
create index if not exists employees_user_id_idx on public.employees(user_id);

-- 4) Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_employees_updated_at'
      and tgrelid = 'public.employees'::regclass
  ) then
    create trigger set_employees_updated_at
    before update on public.employees
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 5) Remove overloaded RPC signatures to avoid ambiguity
drop function if exists public.set_user_role(uuid, text);
drop function if exists public.set_user_role(uuid, public.user_role);
drop function if exists public.set_user_role(uuid, varchar);

-- 6) Single canonical RPC with admin check
create or replace function public.set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new_role not in ('employee', 'admin') then
    raise exception 'invalid role: %', new_role using errcode = '22000';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.role = 'admin'
  ) then
    raise insufficient_privilege using message = 'Only admins can change roles';
  end if;

  update public.employees
  set role = new_role,
      updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'No employee found for target_user_id %', target_user_id using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Optional: Admin-only update policy (won't override existing broader policies).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees_admin_update'
  ) then
    create policy employees_admin_update
      on public.employees
      for update
      using (
        exists (
          select 1
          from public.employees e
          where e.user_id = auth.uid()
            and e.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.employees e
          where e.user_id = auth.uid()
            and e.role = 'admin'
        )
      );
  end if;
end $$;
