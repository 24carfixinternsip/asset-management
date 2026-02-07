-- Enforce normalized SKU uniqueness (trimmed + case-insensitive) for products.
create unique index if not exists idx_products_p_id_unique_normalized
on public.products ((upper(trim(p_id))));
