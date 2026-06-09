-- ไฟล์สำหรับแก้ไขปัญหาลบ User ใน Auth ไม่ได้ (Foreign Key Constraint)

-- 1. แก้ไขให้ public.users ลบตัวเองอัตโนมัติหาก user ใน auth ถูกลบ (ON DELETE CASCADE)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- หมายเหตุ: หากชื่อ Constraint เดิมไม่ใช่ users_id_fkey โค้ดบรรทัดบนอาจจะไม่ทำงาน
-- แต่เราสามารถเพิ่มใหม่ได้
ALTER TABLE public.users 
ADD CONSTRAINT users_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. กรณีที่ user คนนี้เคยไปสร้างใบเบิกหรือทำรายการไว้ 
-- ไม่ควรลบเอกสารทิ้งตาม แต่ควรเปลี่ยนคนทำรายการเป็น NULL (ON DELETE SET NULL)
-- (ให้รันโค้ดด้านล่างนี้เฉพาะถ้าคุณมีการผูก FK ไว้)
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_created_by_fkey;
ALTER TABLE public.requisitions 
ADD CONSTRAINT requisitions_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) 
ON DELETE SET NULL;

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
ALTER TABLE public.stock_movements 
ADD CONSTRAINT stock_movements_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id) 
ON DELETE SET NULL;
