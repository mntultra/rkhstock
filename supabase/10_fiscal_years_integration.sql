-- =========================================================================
-- RKHSTOCK - FISCAL YEAR INTEGRATION & BACKFILL SYSTEM
-- วัตถุประสงค์: ปรับปรุงฐานข้อมูลเพื่อรอบรับปีงบประมาณ (ไทย) ในการ เบิก/รับ/จ่าย
-- และติดตั้งระบบยกยอดอัตโนมัติ (Carry-Forward) และประทับปีงบประมาณปัจจุบันโดยอัตโนมัติ
-- วิธีใช้: คัดลอกโค้ดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

BEGIN;

-- 1. เพิ่มฟิลด์วันที่เริ่มต้นและสิ้นสุดของปีงบประมาณในตารางหลัก
ALTER TABLE public.fiscal_years
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- ปรับปรุงตารางเพื่อให้ year_name เป็นค่าไม่ซ้ำ (Unique) เพื่อป้องกันข้อมูลทับซ้อน
ALTER TABLE public.fiscal_years 
ADD CONSTRAINT unique_year_name UNIQUE (year_name);

-- 2. เติมข้อมูลประชากรปีงบประมาณ (ราชการไทยเริ่ม 1 ต.ค. ปีก่อนหน้า - 30 ก.ย. ปีปัจจุบัน)
INSERT INTO public.fiscal_years (year_name, start_date, end_date, is_active)
VALUES 
  ('2567', '2023-10-01', '2024-09-30', false),
  ('2568', '2024-10-01', '2025-09-30', false),
  ('2569', '2025-10-01', '2026-09-30', true),
  ('2570', '2026-10-01', '2027-09-30', false)
ON CONFLICT (year_name) 
DO UPDATE SET 
  start_date = EXCLUDED.start_date, 
  end_date = EXCLUDED.end_date;

-- 3. เพิ่มฟิลด์คีย์นอก (fiscal_year_id) ในตารางธุรกรรมทั้งหมด
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS fiscal_year_id UUID REFERENCES public.fiscal_years(id) ON DELETE SET NULL;

ALTER TABLE public.requisitions
ADD COLUMN IF NOT EXISTS fiscal_year_id UUID REFERENCES public.fiscal_years(id) ON DELETE SET NULL;

ALTER TABLE public.borrowings
ADD COLUMN IF NOT EXISTS fiscal_year_id UUID REFERENCES public.fiscal_years(id) ON DELETE SET NULL;

-- 4. บันทึกประวัติลิงก์ข้อมูลเก่าอัตโนมัติ (Data Backfill)
UPDATE public.stock_movements sm
SET fiscal_year_id = (
    SELECT id 
    FROM public.fiscal_years fy 
    WHERE (COALESCE(sm.doc_date, sm.created_at::date) BETWEEN fy.start_date AND fy.end_date)
    LIMIT 1
)
WHERE sm.fiscal_year_id IS NULL;

UPDATE public.requisitions r
SET fiscal_year_id = (
    SELECT id 
    FROM public.fiscal_years fy 
    WHERE (COALESCE(r.doc_date, r.created_at::date) BETWEEN fy.start_date AND fy.end_date)
    LIMIT 1
)
WHERE r.fiscal_year_id IS NULL;

UPDATE public.borrowings b
SET fiscal_year_id = (
    SELECT id 
    FROM public.fiscal_years fy 
    WHERE (b.created_at::date BETWEEN fy.start_date AND fy.end_date)
    LIMIT 1
)
WHERE b.fiscal_year_id IS NULL;

-- เติมค่ายืนพื้นหากรายการใดไม่สามารถจัดช่วงวันได้ ให้ผูกกับปีงบประมาณปัจจุบัน (2569)
UPDATE public.stock_movements SET fiscal_year_id = (SELECT id FROM public.fiscal_years WHERE is_active = true LIMIT 1) WHERE fiscal_year_id IS NULL;
UPDATE public.requisitions SET fiscal_year_id = (SELECT id FROM public.fiscal_years WHERE is_active = true LIMIT 1) WHERE fiscal_year_id IS NULL;
UPDATE public.borrowings SET fiscal_year_id = (SELECT id FROM public.fiscal_years WHERE is_active = true LIMIT 1) WHERE fiscal_year_id IS NULL;

-- 5. ติดตั้ง Database Trigger เพื่อประทับปีงบประมาณปัจจุบันให้อัตโนมัติ (Server-side auto assignment)
CREATE OR REPLACE FUNCTION auto_assign_fiscal_year()
RETURNS TRIGGER AS $$
DECLARE
    v_active_year_id UUID;
BEGIN
    IF NEW.fiscal_year_id IS NULL THEN
        -- ค้นหาปีงบประมาณที่กะรันต์ทำงานอยู่ปัจจุบัน
        SELECT id INTO v_active_year_id
        FROM public.fiscal_years
        WHERE is_active = true
        LIMIT 1;
        
        NEW.fiscal_year_id := v_active_year_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ติดตั้ง Trigger สำหรับตารางความเคลื่อนไหวสต๊อก
DROP TRIGGER IF EXISTS trg_auto_fiscal_year_movements ON public.stock_movements;
CREATE TRIGGER trg_auto_fiscal_year_movements
BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION auto_assign_fiscal_year();

-- ติดตั้ง Trigger สำหรับตารางการเบิกเวชภัณฑ์
DROP TRIGGER IF EXISTS trg_auto_fiscal_year_requisitions ON public.requisitions;
CREATE TRIGGER trg_auto_fiscal_year_requisitions
BEFORE INSERT ON public.requisitions
FOR EACH ROW EXECUTE FUNCTION auto_assign_fiscal_year();

-- ติดตั้ง Trigger สำหรับตารางการยืม-คืน
DROP TRIGGER IF EXISTS trg_auto_fiscal_year_borrowings ON public.borrowings;
CREATE TRIGGER trg_auto_fiscal_year_borrowings
BEFORE INSERT ON public.borrowings
FOR EACH ROW EXECUTE FUNCTION auto_assign_fiscal_year();

COMMIT;
