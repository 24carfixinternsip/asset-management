-- Navigation groups/items + user status enhancements

-- Employees: link to auth user + status
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'));

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

-- Navigation groups
CREATE TABLE IF NOT EXISTS public.navigation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  icon text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_core boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Navigation items
CREATE TABLE IF NOT EXISTS public.navigation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.navigation_groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  path text NOT NULL,
  icon text,
  order_index integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  roles text[] NOT NULL DEFAULT '{admin,viewer}',
  is_core boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_navigation_groups_order ON public.navigation_groups(order_index);
CREATE INDEX IF NOT EXISTS idx_navigation_items_group ON public.navigation_items(group_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_order ON public.navigation_items(order_index);

-- RLS
ALTER TABLE public.navigation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;

-- Policies (open for now, match existing pattern)
CREATE POLICY IF NOT EXISTS "Allow public read navigation_groups" ON public.navigation_groups FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert navigation_groups" ON public.navigation_groups FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update navigation_groups" ON public.navigation_groups FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete navigation_groups" ON public.navigation_groups FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read navigation_items" ON public.navigation_items FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert navigation_items" ON public.navigation_items FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update navigation_items" ON public.navigation_items FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete navigation_items" ON public.navigation_items FOR DELETE USING (true);
