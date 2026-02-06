-- Admin-only write policies for locations with authenticated read access.
-- Uses employees.role = 'admin' as the canonical admin indicator.

alter table public.locations enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.role = 'admin'
  );
$$;

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
with check (public.is_admin());

create policy "locations_update_admin"
on public.locations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "locations_delete_admin"
on public.locations
for delete
to authenticated
using (public.is_admin());
