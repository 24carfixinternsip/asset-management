-- Keep transactions.status aligned to the only valid runtime statuses.
-- Also backfill/update updated_at for reliable optimistic UI updates.

begin;

alter table public.transactions
  add column if not exists updated_at timestamptz not null default now();

update public.transactions
set status = case
  when status is null then 'Pending'
  when lower(btrim(status)) = 'pending' then 'Pending'
  when lower(btrim(status)) = 'active' then 'Active'
  when lower(btrim(status)) = 'rejected' then 'Rejected'
  when lower(btrim(status)) = 'completed' then 'Completed'
  when lower(btrim(status)) in ('pendingreturn', 'returnrequested', 'returning') then 'Pending'
  else 'Pending'
end,
updated_at = now();

alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('Pending', 'Active', 'Rejected', 'Completed'));

create or replace function public.set_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_set_updated_at on public.transactions;

create trigger trg_transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_transactions_updated_at();

commit;
