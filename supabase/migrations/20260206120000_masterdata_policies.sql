-- Ensure master-data tables are readable/writable for authenticated app usage
-- (Aligns with existing public-access patterns used elsewhere in this project.)

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert departments" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update departments" ON public.departments FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete departments" ON public.departments FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete locations" ON public.locations FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete categories" ON public.categories FOR DELETE USING (true);
