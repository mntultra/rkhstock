-- =========================================================================
-- RKHSTOCK - DATABASE FIXES & MIGRATION (UPDATED FOR DATE-BASED FISCAL YEARS)
-- วัตถุประสงค์: 
-- 1. เพิ่มค่าใน ENUM requisition_status ให้รองรับสถานะ 'COMPLETED' และ 'REJECTED'
-- 2. ปรับปรุงฟังก์ชัน auto_assign_fiscal_year() ให้คำนวณปีงบประมาณตามวันที่ของเอกสาร (doc_date) แทนการยึดปีที่ Active เพียงอย่างเดียว
-- 3. อัปเดตข้อมูลย้อนหลัง (Backfill) สำหรับเอกสารที่ระบุปีงบประมาณผิดพลาดไปก่อนหน้านี้
-- วิธีใช้: คัดลอกโค้ดทั้งหมดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

-- 1. เพิ่มค่าสถานะ 'COMPLETED' และ 'REJECTED' ใน Enum Type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'requisition_status' AND e.enumlabel = 'COMPLETED'
    ) THEN
        ALTER TYPE public.requisition_status ADD VALUE 'COMPLETED';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'requisition_status' AND e.enumlabel = 'REJECTED'
    ) THEN
        ALTER TYPE public.requisition_status ADD VALUE 'REJECTED';
    END IF;
END $$;

-- 2. ปรับปรุงฟังก์ชัน auto_assign_fiscal_year ให้คำนวณตามวันที่จริงของเอกสาร
CREATE OR REPLACE FUNCTION auto_assign_fiscal_year()
RETURNS TRIGGER AS $$
DECLARE
    v_year_id UUID;
    v_doc_date DATE;
BEGIN
    IF NEW.fiscal_year_id IS NULL THEN
        -- เลือกวันที่ที่จะนำมาวิเคราะห์ตามโครงสร้างตาราง
        IF TG_TABLE_NAME = 'requisitions' THEN
            v_doc_date := NEW.doc_date;
        ELSIF TG_TABLE_NAME = 'stock_movements' THEN
            v_doc_date := NEW.doc_date;
        ELSE
            -- สำหรับ borrowings หรือตารางอื่นๆ ที่ไม่มี doc_date ให้ใช้วันที่ปัจจุบัน
            v_doc_date := CURRENT_DATE;
        END IF;

        -- ค้นหาปีงบประมาณจากตาราง master_fiscal_years ที่วันเอกสารอยู่ในช่วง start_date ถึง end_date
        SELECT id INTO v_year_id
        FROM public.master_fiscal_years
        WHERE v_doc_date BETWEEN start_date AND end_date
        LIMIT 1;
        
        -- หากไม่พบช่วงวัน ให้ดึงปีงบประมาณที่ active ล่าสุดมาใช้งาน
        IF v_year_id IS NULL THEN
            SELECT id INTO v_year_id
            FROM public.master_fiscal_years
            WHERE is_active = true
            LIMIT 1;
        END IF;

        NEW.fiscal_year_id := v_year_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. อัปเดตข้อมูลย้อนหลัง (Backfill) สำหรับเอกสารที่บันทึกปีงบประมาณผิดพลาดไปแล้ว
-- ช่วยดึงข้อมูลใบเบิกและเอกสารสต๊อกทั้งหมดกลับคืนสู่ปีงบประมาณที่ถูกต้อง
UPDATE public.requisitions r
SET fiscal_year_id = (
    SELECT id 
    FROM public.master_fiscal_years fy 
    WHERE r.doc_date BETWEEN fy.start_date AND fy.end_date
    LIMIT 1
)
WHERE doc_date IS NOT NULL;

UPDATE public.stock_movements sm
SET fiscal_year_id = (
    SELECT id 
    FROM public.master_fiscal_years fy 
    WHERE sm.doc_date BETWEEN fy.start_date AND fy.end_date
    LIMIT 1
)
WHERE doc_date IS NOT NULL;
