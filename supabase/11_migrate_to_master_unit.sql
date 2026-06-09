-- 1. ย้ายข้อมูลหน่วยนับเดิมจากตาราง units (หากมีตารางนี้อยู่) ไปยังตาราง master_unit
-- ใช้ PL/pgSQL block แบบไดนามิกเพื่อป้องกันข้อผิดพลาดกรณีไม่มีตาราง units อยู่แต่แรก
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'units') THEN
        EXECUTE 'INSERT INTO public.master_unit (id, unit_name, created_at)
                 SELECT id, name, created_at FROM public.units
                 ON CONFLICT (id) DO NOTHING;';
    END IF;
END $$;

-- 2. อัปเดตข้อกำหนด Foreign Key บนตาราง products ให้ชี้ไปยังตาราง master_unit
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unit_id_fkey;

ALTER TABLE public.products 
ADD CONSTRAINT products_unit_id_fkey 
FOREIGN KEY (unit_id) REFERENCES public.master_unit(id);

-- 3. เปิดใช้งาน RLS และกำหนดสิทธิ์ความปลอดภัยให้กลุ่มผู้ใช้งานล็อกอินจัดการข้อมูลในตาราง master_unit ได้
ALTER TABLE public.master_unit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.master_unit;

CREATE POLICY "Enable all operations for authenticated users" 
ON public.master_unit 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. ลบตาราง units เดิมออกเพื่อลดความซ้ำซ้อนของข้อมูล (เฉพาะเมื่อเคยมีตารางนี้อยู่)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'units') THEN
        EXECUTE 'DROP TABLE IF EXISTS public.units CASCADE;';
    END IF;
END $$;
