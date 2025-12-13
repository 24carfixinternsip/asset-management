-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  building TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emp_code TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  tel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  p_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  price DECIMAL(12,2) DEFAULT 0,
  unit TEXT DEFAULT 'ชิ้น',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create product_serials table
CREATE TABLE public.product_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  serial_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'Ready' CHECK (status IN ('Ready', 'Borrowed', 'Repair', 'Missing')),
  sticker_status TEXT DEFAULT 'Pending' CHECK (sticker_status IN ('Pending', 'Done')),
  sticker_date DATE,
  sticker_image_url TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL NOT NULL,
  serial_id UUID REFERENCES public.product_serials(id) ON DELETE CASCADE NOT NULL,
  borrow_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  return_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_product_serials_product_id ON public.product_serials(product_id);
CREATE INDEX idx_product_serials_status ON public.product_serials(status);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_employees_department_id ON public.employees(department_id);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (for now, can add auth later)
CREATE POLICY "Allow public read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Allow public insert departments" ON public.departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update departments" ON public.departments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete departments" ON public.departments FOR DELETE USING (true);

CREATE POLICY "Allow public read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Allow public insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete locations" ON public.locations FOR DELETE USING (true);

CREATE POLICY "Allow public read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update employees" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Allow public delete employees" ON public.employees FOR DELETE USING (true);

CREATE POLICY "Allow public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete products" ON public.products FOR DELETE USING (true);

CREATE POLICY "Allow public read product_serials" ON public.product_serials FOR SELECT USING (true);
CREATE POLICY "Allow public insert product_serials" ON public.product_serials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update product_serials" ON public.product_serials FOR UPDATE USING (true);
CREATE POLICY "Allow public delete product_serials" ON public.product_serials FOR DELETE USING (true);

CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete transactions" ON public.transactions FOR DELETE USING (true);

-- Insert some default data
INSERT INTO public.departments (name) VALUES 
  ('ฝ่ายไอที'),
  ('ฝ่ายบัญชี'),
  ('ฝ่ายบุคคล'),
  ('ฝ่ายการตลาด');

INSERT INTO public.locations (name, building) VALUES 
  ('ห้องเซิร์ฟเวอร์', 'อาคาร A'),
  ('สำนักงานชั้น 1', 'อาคาร A'),
  ('สำนักงานชั้น 2', 'อาคาร B'),
  ('คลังสินค้า', 'อาคาร C');

-- Create storage bucket for asset images
INSERT INTO storage.buckets (id, name, public) VALUES ('asset-images', 'asset-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access to asset-images" ON storage.objects FOR SELECT USING (bucket_id = 'asset-images');
CREATE POLICY "Allow uploads to asset-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'asset-images');
CREATE POLICY "Allow updates to asset-images" ON storage.objects FOR UPDATE USING (bucket_id = 'asset-images');
CREATE POLICY "Allow deletes from asset-images" ON storage.objects FOR DELETE USING (bucket_id = 'asset-images');