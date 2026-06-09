-- เปิดการใช้งาน RLS (หากยังไม่ได้เปิด)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ลบ Policy เดิมที่อาจจะตั้งชื่อซ้ำไว้ (ถ้ามี)
DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON public.users;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;

-- อนุญาตให้ผู้ใช้ที่ล็อกอินแล้ว (authenticated) สามารถ Select, Insert, Update, Delete ข้อมูลในตาราง users ได้
CREATE POLICY "Enable all operations for authenticated users" 
ON public.users 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
