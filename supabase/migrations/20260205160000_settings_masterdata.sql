-- Extend master data tables for Settings module
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_type_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_type_check CHECK (type IN ('main', 'sub'));
  END IF;
END $$;

-- Initialize existing categories
UPDATE public.categories
SET type = 'main'
WHERE type IS NULL;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.categories
  WHERE parent_id IS NULL
)
UPDATE public.categories c
SET sort_order = o.rn
FROM ordered o
WHERE c.id = o.id;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);
