-- =========================================================================
-- ส่วนที่ 1: แก้ไขสิทธิ์การเข้าถึง (RLS) ของตาราง warehouses (คลัง/จุดจ่าย)
-- =========================================================================

-- 1. เปิดใช้งาน Row Level Security (RLS) บนตาราง warehouses (หากยังไม่ได้เปิด)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- 2. ลบ Policy เดิมที่มีชื่อซ้ำหรือทับซ้อนออก
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.warehouses;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.warehouses;

-- 3. สร้าง RLS Policy ใหม่อนุญาตผู้ใช้งานที่ล็อกอินแล้ว (authenticated) จัดการข้อมูลคลังสินค้าได้ทั้งหมด
CREATE POLICY "Enable all for authenticated" 
ON public.warehouses 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =========================================================================
-- ส่วนที่ 2: แก้ไข Foreign Key ของตาราง default_officers (ผู้รับผิดชอบเริ่มต้น)
-- =========================================================================

-- 1. ลบ Foreign Key Constraint เดิมที่ชี้ไปยังตาราง users
ALTER TABLE public.default_officers DROP CONSTRAINT IF EXISTS default_officers_user_id_fkey;

-- 2. สร้าง Foreign Key Constraint ใหม่ชี้ไปยังตาราง staffs แทน (เพื่อให้รองรับเจ้าหน้าที่ที่เพิ่งเพิ่มเข้าไปใหม่)
ALTER TABLE public.default_officers 
ADD CONSTRAINT default_officers_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.staffs(id) ON DELETE SET NULL;
