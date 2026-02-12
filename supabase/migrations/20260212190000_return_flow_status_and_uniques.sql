-- Harden transactions return flow + status constraint + uniqueness guards.
-- Safe for Supabase SQL editor.

begin;

-- Inspect current constraint definition in logs.
do $$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(c.oid)
  into v_constraint_definition
  from pg_constraint c
  where c.conname = 'transactions_status_check'
    and c.conrelid = 'public.transactions'::regclass
  limit 1;

  raise notice 'Current transactions_status_check: %', coalesce(v_constraint_definition, '[missing]');
end $$;

alter table public.transactions
  add column if not exists updated_at timestamptz not null default now();

-- Normalize historical/invalid values into canonical set.
update public.transactions
set
  status = case
    when status is null then 'Pending'
    when lower(btrim(status)) in ('pending', 'pendingapproval', 'pending_approval', 'pendingreturn', 'returnrequested', 'return request', 'returning', 'รออนุมัติ') then 'Pending'
    when lower(btrim(status)) in ('active', 'approved', 'borrowed', 'อนุมัติแล้ว', 'กำลังยืม') then 'Active'
    when lower(btrim(status)) in ('rejected', 'denied', 'ปฏิเสธ', 'ถูกปฏิเสธ') then 'Rejected'
    when lower(btrim(status)) in ('completed', 'done', 'คืนแล้ว') then 'Completed'
    when lower(btrim(status)) in ('returned', 'return', 'คืนสำเร็จ') then 'Returned'
    when lower(btrim(status)) in ('cancelled', 'canceled', 'void', 'ยกเลิก') then 'Cancelled'
    else 'Pending'
  end,
  updated_at = now();

alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('Pending', 'Active', 'Rejected', 'Completed', 'Returned', 'Cancelled'))
  not valid;

alter table public.transactions
  validate constraint transactions_status_check;

-- Keep only one open transaction (Pending/Active) per serial.
with ranked_open as (
  select
    t.id,
    row_number() over (
      partition by t.serial_id
      order by coalesce(t.updated_at, t.created_at, now()) desc, t.id desc
    ) as rn
  from public.transactions t
  where t.status in ('Pending', 'Active')
)
update public.transactions t
set
  status = 'Cancelled',
  note = concat_ws(' | ', nullif(btrim(t.note), ''), 'Auto-cancelled duplicate open transaction during migration'),
  updated_at = now()
from ranked_open ro
where t.id = ro.id
  and ro.rn > 1;

create unique index if not exists idx_transactions_open_serial_unique
  on public.transactions (serial_id)
  where status in ('Pending', 'Active');

-- Normalize employee identity fields.
update public.employees
set
  email = nullif(lower(btrim(email)), ''),
  emp_code = nullif(btrim(emp_code), ''),
  updated_at = now()
where
  email is distinct from nullif(lower(btrim(email)), '')
  or emp_code is distinct from nullif(btrim(emp_code), '');

-- Resolve duplicate email values safely by keeping the newest row's email,
-- and nulling older duplicates to preserve referenced employee records.
with ranked_email as (
  select
    e.id,
    row_number() over (
      partition by lower(btrim(e.email))
      order by coalesce(e.updated_at, e.created_at, now()) desc, e.id desc
    ) as rn
  from public.employees e
  where e.email is not null
    and btrim(e.email) <> ''
)
update public.employees e
set
  email = null,
  updated_at = now()
from ranked_email re
where e.id = re.id
  and re.rn > 1;

-- Resolve duplicate employee codes in the same way.
with ranked_emp_code as (
  select
    e.id,
    row_number() over (
      partition by btrim(e.emp_code)
      order by coalesce(e.updated_at, e.created_at, now()) desc, e.id desc
    ) as rn
  from public.employees e
  where e.emp_code is not null
    and btrim(e.emp_code) <> ''
)
update public.employees e
set
  emp_code = null,
  updated_at = now()
from ranked_emp_code rc
where e.id = rc.id
  and rc.rn > 1;

create unique index if not exists idx_employees_email_unique_lower
  on public.employees ((lower(email)))
  where email is not null and btrim(email) <> '';

create unique index if not exists idx_employees_emp_code_unique_not_null
  on public.employees (emp_code)
  where emp_code is not null and btrim(emp_code) <> '';

-- Ensure one role row per user in user_roles.
create table if not exists public.user_roles (
  user_id uuid not null,
  role text not null default 'employee',
  created_at timestamptz default now()
);

update public.user_roles
set role = lower(btrim(role))
where role is not null;

delete from public.user_roles
where user_id is null
   or role is null
   or btrim(role) = '';

with ranked_roles as (
  select
    ctid,
    row_number() over (
      partition by user_id
      order by
        case when lower(btrim(role)) = 'admin' then 0 else 1 end,
        created_at desc nulls last,
        ctid desc
    ) as rn
  from public.user_roles
)
delete from public.user_roles ur
using ranked_roles rr
where ur.ctid = rr.ctid
  and rr.rn > 1;

create unique index if not exists idx_user_roles_user_id_unique
  on public.user_roles (user_id);

-- Idempotency log for return requests.
create table if not exists public.transaction_return_requests (
  request_id uuid primary key,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  serial_id uuid not null,
  employee_id uuid,
  result_status text not null,
  created_at timestamptz not null default now()
);

alter table public.transaction_return_requests
  drop constraint if exists transaction_return_requests_result_status_check;

alter table public.transaction_return_requests
  add constraint transaction_return_requests_result_status_check
  check (result_status in ('Pending', 'Active', 'Rejected', 'Completed', 'Returned', 'Cancelled'))
  not valid;

alter table public.transaction_return_requests
  validate constraint transaction_return_requests_result_status_check;

create index if not exists idx_transaction_return_requests_transaction
  on public.transaction_return_requests (transaction_id);

create or replace function public.return_transaction(
  arg_transaction_id uuid,
  arg_note text default null,
  arg_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid := coalesce(arg_request_id, gen_random_uuid());
  v_tx public.transactions%rowtype;
  v_existing public.transaction_return_requests%rowtype;
  v_note text;
begin
  if arg_transaction_id is null then
    raise exception using errcode = '22023', message = 'transaction_id is required';
  end if;

  select *
  into v_existing
  from public.transaction_return_requests
  where request_id = v_request_id
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'replayed', true,
      'request_id', v_existing.request_id,
      'transaction_id', v_existing.transaction_id,
      'status', v_existing.result_status
    );
  end if;

  select *
  into v_tx
  from public.transactions
  where id = arg_transaction_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transaction not found';
  end if;

  if v_tx.status in ('Completed', 'Returned', 'Cancelled') then
    insert into public.transaction_return_requests (
      request_id,
      transaction_id,
      serial_id,
      employee_id,
      result_status
    ) values (
      v_request_id,
      v_tx.id,
      v_tx.serial_id,
      v_tx.employee_id,
      v_tx.status
    )
    on conflict (request_id) do nothing;

    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'replayed', false,
      'request_id', v_request_id,
      'transaction_id', v_tx.id,
      'status', v_tx.status
    );
  end if;

  if v_tx.status <> 'Active' then
    raise exception using errcode = '22023', message = 'transaction is not active';
  end if;

  v_note := nullif(left(btrim(coalesce(arg_note, '')), 500), '');

  update public.transactions
  set
    status = 'Returned',
    return_date = coalesce(return_date, now()),
    note = coalesce(v_note, note),
    updated_at = now()
  where id = v_tx.id
  returning * into v_tx;

  update public.product_serials
  set status = 'ready'
  where id = v_tx.serial_id
    and coalesce(status, '') <> 'ready';

  insert into public.transaction_return_requests (
    request_id,
    transaction_id,
    serial_id,
    employee_id,
    result_status
  ) values (
    v_request_id,
    v_tx.id,
    v_tx.serial_id,
    v_tx.employee_id,
    v_tx.status
  )
  on conflict (request_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'replayed', false,
    'request_id', v_request_id,
    'transaction_id', v_tx.id,
    'status', v_tx.status
  );

exception
  when unique_violation then
    select *
    into v_existing
    from public.transaction_return_requests
    where request_id = v_request_id
    limit 1;

    if found then
      return jsonb_build_object(
        'success', true,
        'replayed', true,
        'request_id', v_existing.request_id,
        'transaction_id', v_existing.transaction_id,
        'status', v_existing.result_status
      );
    end if;

    raise;
end;
$$;

grant execute on function public.return_transaction(uuid, text, uuid) to authenticated;

commit;

-- Verification queries
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'transactions_status_check'
  and conrelid = 'public.transactions'::regclass;

select status, count(*) as total
from public.transactions
group by status
order by status;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_transactions_open_serial_unique',
    'idx_employees_email_unique_lower',
    'idx_employees_emp_code_unique_not_null',
    'idx_user_roles_user_id_unique'
  )
order by indexname;

select proname, oidvectortypes(proargtypes) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'return_transaction';
