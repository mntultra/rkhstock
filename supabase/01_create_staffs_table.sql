-- 1. สร้างตาราง staffs
CREATE TABLE IF NOT EXISTS public.staffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    position VARCHAR(150),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. ย้ายข้อมูลจาก users ไป staffs
INSERT INTO public.staffs (id, title, first_name, last_name, full_name, position, email)
SELECT id, title, first_name, last_name, full_name, position, email
FROM public.users
ON CONFLICT (id) DO NOTHING;

-- 3. ลบ FK เดิม (ถ้ามี) บนตาราง requisitions
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_requester_id_fkey;
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_approver_id_fkey;

-- 4. สร้าง FK ใหม่ ให้ชี้ไปที่ตาราง staffs
-- หมายเหตุ: หากขึ้น Warning/Error ตรงนี้เนื่องจากไม่ได้สร้าง FK ไว้แต่แรก สามารถข้ามไปได้ครับ
ALTER TABLE public.requisitions 
ADD CONSTRAINT requisitions_requester_id_fkey 
FOREIGN KEY (requester_id) REFERENCES public.staffs(id);

ALTER TABLE public.requisitions 
ADD CONSTRAINT requisitions_approver_id_fkey 
FOREIGN KEY (approver_id) REFERENCES public.staffs(id);

-- 5. เพิ่ม staff_id ในตาราง users เพื่อเชื่อมโยง (เผื่ออนาคต)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staffs(id);

-- 6. เปิดใช้งาน RLS สำหรับ staffs
ALTER TABLE public.staffs ENABLE ROW LEVEL SECURITY;

-- ลบ Policy เดิมที่อาจจะตั้งชื่อซ้ำไว้ (ถ้ามี)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.staffs;

-- 7. กำหนด Policy ให้ Authenticated Users สามารถจัดการข้อมูลเจ้าหน้าที่ได้
CREATE POLICY "Enable all operations for authenticated users" 
ON public.staffs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
