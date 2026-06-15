-- 1. organization_info (ข้อมูลพื้นฐานองค์กร)
CREATE TABLE IF NOT EXISTS public.organization_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name VARCHAR(255),
  address_no VARCHAR(100),
  subdistrict VARCHAR(100),
  district VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  fax VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. fiscal_years (ปีงบประมาณ)
CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_name VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. departments (กลุ่มงาน/ฝ่าย)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. staff_positions (ตำแหน่งเจ้าหน้าที่)
CREATE TABLE IF NOT EXISTS public.staff_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. default_officers (เจ้าหน้าที่เริ่มต้น)
CREATE TABLE IF NOT EXISTS public.default_officers (
  role_key VARCHAR(50) PRIMARY KEY, -- e.g., 'hospital_director', 'head_pharmacy', 'head_warehouse', 'issuer', 'receiver', 'approver'
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. dosage_forms (รูปแบบเวชภัณฑ์)
CREATE TABLE IF NOT EXISTS public.dosage_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(255) NOT NULL,
  name_th VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(50),
  main_category VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. product_types (ประเภทเวชภัณฑ์)
CREATE TABLE IF NOT EXISTS public.product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Alter Products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS dosage_form_id UUID REFERENCES public.dosage_forms(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS pack_size INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS product_type_id UUID REFERENCES public.product_types(id) ON DELETE RESTRICT;

-- Make drug_code unique
ALTER TABLE public.products ADD CONSTRAINT unique_drug_code UNIQUE (drug_code);

-- 9. Setup basic RLS (Allow all for authenticated users for simplicity in internal tool)
ALTER TABLE public.organization_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.organization_info FOR ALL TO authenticated USING (true);

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.fiscal_years FOR ALL TO authenticated USING (true);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.departments FOR ALL TO authenticated USING (true);

ALTER TABLE public.staff_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.staff_positions FOR ALL TO authenticated USING (true);

ALTER TABLE public.default_officers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.default_officers FOR ALL TO authenticated USING (true);

ALTER TABLE public.dosage_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.dosage_forms FOR ALL TO authenticated USING (true);

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated" ON public.product_types FOR ALL TO authenticated USING (true);

-- 10. Default initialization for organization_info if empty
INSERT INTO public.organization_info (org_name)
SELECT 'ชื่อโรงพยาบาล/ส่วนราชการ'
WHERE NOT EXISTS (SELECT 1 FROM public.organization_info);
