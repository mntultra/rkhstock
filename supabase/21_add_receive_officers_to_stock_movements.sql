-- =========================================================================
-- Migration 21: Add Receive Officers & Note to stock_movements
-- วัตถุประสงค์:
--   1. เพิ่ม approver_id  — ผู้อนุมัติจ่ายเวชภัณฑ์ (คลังหลัก)
--   2. เพิ่ม dispenser_id — ผู้จ่ายเวชภัณฑ์ (คลังหลัก)
--   3. เพิ่ม from_warehouse_id — คลังต้นทาง (FK ไปยัง master_warehouses)
--   4. เพิ่ม note — หมายเหตุระดับเอกสาร
-- วิธีใช้: คัดลอกโค้ดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS approver_id   UUID REFERENCES public.officers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispenser_id  UUID REFERENCES public.officers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_warehouse_id UUID REFERENCES public.master_warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note          TEXT;

COMMENT ON COLUMN public.stock_movements.approver_id      IS 'ผู้อนุมัติจ่ายเวชภัณฑ์ (คลังหลัก) — FK officers';
COMMENT ON COLUMN public.stock_movements.dispenser_id     IS 'ผู้จ่ายเวชภัณฑ์ (คลังหลัก) — FK officers';
COMMENT ON COLUMN public.stock_movements.from_warehouse_id IS 'คลังต้นทางที่รับเวชภัณฑ์มา — FK master_warehouses';
COMMENT ON COLUMN public.stock_movements.note             IS 'หมายเหตุระดับเอกสาร';
