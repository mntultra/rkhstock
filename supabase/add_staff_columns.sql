-- เพิ่มคอลัมน์สำหรับเก็บข้อมูลส่วนตัวของเจ้าหน้าที่
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS title VARCHAR(50),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS position VARCHAR(150);

-- อัพเดตข้อมูลเดิมให้แยกชื่อ-นามสกุล (ทำแบบคร่าวๆ จาก full_name ถ้ามี)
-- หมายเหตุ: หากไม่ต้องการอัพเดตข้อมูลเดิม สามารถข้ามขั้นตอนนี้ได้
UPDATE public.users 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = substring(full_name from position(' ' in full_name) + 1)
WHERE full_name IS NOT NULL AND first_name IS NULL;
