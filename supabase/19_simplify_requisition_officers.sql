-- SQL Migration script สำหรับลบคอลัมน์ที่ไม่ได้ใช้และยืนยันโครงสร้างตาราง requisitions
-- รันไฟล์นี้ใน Supabase SQL Editor เพื่ออัปเดตโครงสร้างฐานข้อมูล

-- 1. ลบคอลัมน์ dispenser_id และ dispenser_position ที่เคยเพิ่มในตาราง requisitions
ALTER TABLE public.requisitions 
  DROP COLUMN IF EXISTS dispenser_id CASCADE,
  DROP COLUMN IF EXISTS dispenser_position CASCADE;

-- 2. ตรวจสอบและยืนยันว่ามีคอลัมน์ approver_id และ approver_position ในตาราง requisitions เรียบร้อยแล้ว
-- (ตาราง requisitions มี approver_id มาตั้งแต่เริ่มต้นระบบ)
ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES public.staffs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approver_position VARCHAR(255);
