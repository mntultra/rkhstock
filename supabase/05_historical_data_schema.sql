-- =========================================================================
-- Schema Update: Historical Data Preservation (Snapshot Data)
-- วัตถุประสงค์: เพื่อเก็บข้อมูล ณ เวลาที่ทำรายการ (Snapshot) ป้องกันปัญหาข้อมูล 
-- เปลี่ยนแปลงในอนาคต (เช่น ตำแหน่งเจ้าหน้าที่เปลี่ยน, แพ็กเกจยาเปลี่ยนขนาด)
-- รบกวนนำสคริปต์นี้ไปรันใน Supabase SQL Editor
-- =========================================================================

-- 1. Table: requisitions (ใบเบิก)
-- เพิ่มตำแหน่งของผู้เบิกและผู้ตรวจรับ
ALTER TABLE public.requisitions 
ADD COLUMN IF NOT EXISTS requester_position VARCHAR(255),
ADD COLUMN IF NOT EXISTS approver_position VARCHAR(255);

-- 2. Table: requisition_items (รายการเบิก)
-- เพิ่มขนาดบรรจุ (pack_size) และชื่อหน่วยนับ (unit_name) ของยา ณ ขณะที่ทำรายการ
ALTER TABLE public.requisition_items 
ADD COLUMN IF NOT EXISTS pack_size INTEGER,
ADD COLUMN IF NOT EXISTS unit_name VARCHAR(100);

-- 3. Table: stock_movements (หัวเอกสารความเคลื่อนไหวสต๊อก เช่น จ่าย/รับ/ปรับยอด)
-- เพิ่มตำแหน่งของผู้ทำรายการ (ผู้จ่าย, ผู้รับ, หรือผู้ปรับยอด)
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS created_by_position VARCHAR(255);

-- 4. Table: stock_movement_items (รายการความเคลื่อนไหวสต๊อก)
-- เพิ่มขนาดบรรจุ (pack_size) และชื่อหน่วยนับ (unit_name) ของยา ณ ขณะที่ทำรายการ
ALTER TABLE public.stock_movement_items 
ADD COLUMN IF NOT EXISTS pack_size INTEGER,
ADD COLUMN IF NOT EXISTS unit_name VARCHAR(100);

-- 5. Table: borrowings (รายการยืม-คืน)
-- เพิ่มตำแหน่งของผู้ยืม, ขนาดบรรจุ (pack_size) และชื่อหน่วยนับ (unit_name)
ALTER TABLE public.borrowings 
ADD COLUMN IF NOT EXISTS borrower_position VARCHAR(255),
ADD COLUMN IF NOT EXISTS pack_size INTEGER,
ADD COLUMN IF NOT EXISTS unit_name VARCHAR(100);
