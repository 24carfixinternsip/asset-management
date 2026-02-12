begin;

alter table public.transactions
  add column if not exists updated_at timestamptz not null default now();

-- Normalize existing values into canonical statuses used by the app.
update public.transactions
set
  status = case
    when status is null then 'Pending'
    when lower(btrim(status)) in ('pending', 'pendingapproval', 'pending_approval') then 'Pending'
    when lower(btrim(status)) in ('active', 'approved', 'borrowed') then 'Active'
    when lower(btrim(status)) in ('rejected', 'denied', 'cancelled', 'canceled', 'void') then 'Rejected'
    when lower(btrim(status)) in ('completed', 'done', 'return', 'returned') then 'Completed'
    else 'Pending'
  end,
  updated_at = now();

-- Trigger keeps write values canonical and auto-fills return_date for Completed.
create or replace function public.transactions_normalize_and_touch()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or btrim(new.status) = '' then
    new.status := 'Pending';
  else
    case lower(btrim(new.status))
      when 'pending' then new.status := 'Pending';
      when 'pendingapproval' then new.status := 'Pending';
      when 'pending_approval' then new.status := 'Pending';
      when 'active' then new.status := 'Active';
      when 'approved' then new.status := 'Active';
      when 'borrowed' then new.status := 'Active';
      when 'rejected' then new.status := 'Rejected';
      when 'denied' then new.status := 'Rejected';
      when 'cancelled' then new.status := 'Rejected';
      when 'canceled' then new.status := 'Rejected';
      when 'void' then new.status := 'Rejected';
      when 'completed' then new.status := 'Completed';
      when 'done' then new.status := 'Completed';
      when 'return' then new.status := 'Completed';
      when 'returned' then new.status := 'Completed';
      else
        raise exception using errcode = '22023', message = 'INVALID_TRANSACTION_STATUS';
    end case;
  end if;

  if new.status = 'Completed' and new.return_date is null then
    new.return_date := now();
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transactions_set_updated_at on public.transactions;
drop trigger if exists trg_transactions_normalize_and_touch on public.transactions;

create trigger trg_transactions_normalize_and_touch
before insert or update on public.transactions
for each row
execute function public.transactions_normalize_and_touch();

-- Case-insensitive check; allows legacy inputs (return/returned) that trigger maps to Completed.
alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (lower(btrim(status)) in ('pending', 'active', 'rejected', 'completed', 'return', 'returned'));

-- Keep only one active open transaction per serial.
with ranked_active as (
  select
    t.id,
    row_number() over (partition by t.serial_id order by t.created_at desc, t.id desc) as rn
  from public.transactions t
  where lower(btrim(t.status)) = 'active'
    and t.return_date is null
)
update public.transactions t
set
  status = 'Completed',
  return_date = coalesce(t.return_date, now()),
  note = concat_ws(' | ', nullif(btrim(t.note), ''), 'Auto-completed duplicate active transaction'),
  updated_at = now()
from ranked_active r
where t.id = r.id
  and r.rn > 1;

drop index if exists public.idx_transactions_open_serial_unique;
drop index if exists public.uq_transactions_active_serial;

create unique index if not exists uq_transactions_active_serial
  on public.transactions (serial_id)
  where lower(btrim(status)) = 'active'
    and return_date is null;

-- New RPC used by Portal UI (no external fetch/CORS).
drop function if exists public.rpc_return_transaction(uuid, text);

create or replace function public.rpc_return_transaction(
  p_transaction_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_note text;
  v_available_status text := coalesce(
    nullif(current_setting('app.portal_available_serial_status', true), ''),
    'ready'
  );
begin
  if p_transaction_id is null then
    raise exception using errcode = '22023', message = 'INVALID_TRANSACTION_ID';
  end if;

  select *
  into v_tx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRANSACTION_NOT_FOUND';
  end if;

  if lower(btrim(v_tx.status)) <> 'active' or v_tx.return_date is not null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_TRANSACTION';
  end if;

  v_note := nullif(left(btrim(coalesce(p_note, '')), 500), '');

  update public.transactions
  set
    status = 'Completed',
    return_date = coalesce(return_date, now()),
    note = coalesce(v_note, note),
    updated_at = now()
  where id = v_tx.id
  returning * into v_tx;

  update public.product_serials
  set status = v_available_status
  where id = v_tx.serial_id
    and coalesce(status, '') <> v_available_status;

  return v_tx.id;
end;
$$;

grant execute on function public.rpc_return_transaction(uuid, text) to authenticated;

commit;
