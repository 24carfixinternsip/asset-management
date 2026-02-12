-- Add hierarchical category compatibility column and harden locations RLS for admins.

begin;

-- 1) Categories: support parent_category_id while keeping parent_id backward compatible.
alter table public.categories
  add column if not exists parent_category_id uuid references public.categories(id) on delete set null;

create index if not exists idx_categories_parent_category_id
  on public.categories(parent_category_id);

-- Normalize legacy rows so both columns are aligned.
update public.categories
set
  parent_id = coalesce(parent_category_id, parent_id),
  parent_category_id = coalesce(parent_category_id, parent_id)
where
  parent_id is distinct from coalesce(parent_category_id, parent_id)
  or parent_category_id is distinct from coalesce(parent_category_id, parent_id);

create or replace function public.sync_category_parent_columns()
returns trigger
language plpgsql
as $$
begin
  if new.parent_category_id is null and new.parent_id is not null then
    new.parent_category_id := new.parent_id;
  elsif new.parent_id is null and new.parent_category_id is not null then
    new.parent_id := new.parent_category_id;
  elsif new.parent_id is distinct from new.parent_category_id then
    new.parent_category_id := coalesce(new.parent_category_id, new.parent_id);
    new.parent_id := new.parent_category_id;
  end if;

  if new.id is not null and (new.parent_id = new.id or new.parent_category_id = new.id) then
    raise exception 'Category cannot reference itself as parent';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_categories_sync_parent_columns on public.categories;
create trigger trg_categories_sync_parent_columns
before insert or update on public.categories
for each row execute function public.sync_category_parent_columns();

-- 2) Locations: robust admin policy helper and admin-only write policies.
create or replace function public.is_admin_actor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce((auth.jwt() ->> 'role') = 'service_role', false)
    or coalesce(lower(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    or coalesce(lower(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
    or exists (
      select 1
      from public.employees e
      where e.user_id = auth.uid()
        and lower(coalesce(e.role, '')) = 'admin'
        and coalesce(e.status, 'active') = 'active'
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and lower(coalesce(ur.role, '')) = 'admin'
    );
$$;

revoke all on function public.is_admin_actor() from public;
grant execute on function public.is_admin_actor() to authenticated;

alter table public.locations enable row level security;

drop policy if exists "Allow public read locations" on public.locations;
drop policy if exists "Allow public insert locations" on public.locations;
drop policy if exists "Allow public update locations" on public.locations;
drop policy if exists "Allow public delete locations" on public.locations;
drop policy if exists "locations_select" on public.locations;
drop policy if exists "locations_insert_admin" on public.locations;
drop policy if exists "locations_update_admin" on public.locations;
drop policy if exists "locations_delete_admin" on public.locations;

create policy "locations_select"
on public.locations
for select
to authenticated
using (true);

create policy "locations_insert_admin"
on public.locations
for insert
to authenticated
with check (public.is_admin_actor());

create policy "locations_update_admin"
on public.locations
for update
to authenticated
using (public.is_admin_actor())
with check (public.is_admin_actor());

create policy "locations_delete_admin"
on public.locations
for delete
to authenticated
using (public.is_admin_actor());

commit;
