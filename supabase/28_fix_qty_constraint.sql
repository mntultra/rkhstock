-- =========================================================================
-- Migration 28: Fix qty check constraint on stock_movement_items
-- ปัญหา:
-- constraint `stock_movement_items_qty_check` เดิมจำกัดให้ `qty > 0` (ต้องเป็นบวกเท่านั้น)
-- ทำให้ไม่สามารถบันทึกรายการปรับยอดลดสต๊อก (ADJUST ที่เป็นค่าลบ) หรือการทำลายยาหมดอายุ (DISPOSE/EXPIRED ที่บันทึกเป็นค่าลบ) ได้
--
-- วิธีแก้ไข: ปรับปรุง constraint ให้ยอมรับค่าลบได้ (แต่ห้ามเป็น 0)
-- รบกวนนำสคริปต์นี้ไปรันใน Supabase SQL Editor
-- =========================================================================

BEGIN;

-- 1. ลบ Check Constraint เดิมออก
ALTER TABLE public.stock_movement_items DROP CONSTRAINT IF EXISTS stock_movement_items_qty_check;

-- 2. สร้าง Check Constraint ใหม่ให้ยอมรับค่าติดลบได้ (ห้ามเป็น 0)
ALTER TABLE public.stock_movement_items ADD CONSTRAINT stock_movement_items_qty_check CHECK (qty <> 0);

COMMIT;
