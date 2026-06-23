-- Migration 42: Fix get_usage_rate to use ABS(qty) for ISSUE movements
-- ปัญหา: Migration 28 เปลี่ยน constraint ให้ qty ติดลบได้
--        ทำให้ SUM(smi.qty) ของ ISSUE ที่บันทึกเป็นค่าลบได้ผลเป็น 0 หรือติดลบ
-- แก้ไข: ใช้ SUM(ABS(smi.qty)) และกรอง qty < 0 ออกด้วย WHERE เพื่อให้ได้ค่าจริง

CREATE OR REPLACE FUNCTION public.get_usage_rate(
    p_product_id UUID,
    p_months INT
)
RETURNS TABLE (
    avg_monthly_usage NUMERIC,
    suggested_order_qty NUMERIC,
    last_issue_date DATE
) AS $$
DECLARE
    v_total_qty NUMERIC := 0;
    v_last_date DATE;
    v_current_stock NUMERIC := 0;
    v_safety_months INT := 1;
    v_avg NUMERIC := 0;
    v_suggested NUMERIC := 0;
BEGIN
    -- 1. คำนวณหายอดการจ่ายออก (ISSUE) ทั้งหมดในช่วงเวลาที่กำหนด (ย้อนหลัง p_months เดือน)
    -- เฉพาะเอกสารที่ไม่ถูกยกเลิก (is_voided = false)
    -- ใช้ ABS(qty) เพื่อรองรับ qty ที่ถูกบันทึกเป็นค่าลบ (จาก Migration 28)
    SELECT 
        COALESCE(SUM(ABS(smi.qty)), 0),
        MAX(sm.doc_date)
    INTO 
        v_total_qty,
        v_last_date
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE smi.product_id = p_product_id
      AND sm.movement_type = 'ISSUE'
      AND COALESCE(sm.is_voided, false) = false
      AND sm.doc_date >= CURRENT_DATE - (p_months || ' month')::INTERVAL
      AND sm.doc_date <= CURRENT_DATE;

    -- 2. คำนวณค่าเฉลี่ยต่อเดือน (avg_monthly_usage)
    -- ป้องกัน division by zero กรณี p_months = 0
    IF p_months > 0 THEN
        v_avg := ROUND(v_total_qty::NUMERIC / p_months, 2);
    ELSE
        v_avg := 0;
    END IF;

    -- 3. ดึงยอดคงคลังปัจจุบันทั้งหมดของเวชภัณฑ์นี้
    SELECT COALESCE(SUM(current_qty), 0)
    INTO v_current_stock
    FROM public.stock_balances
    WHERE product_id = p_product_id;

    -- 4. ดึงค่าเดือนสำรองคลัง (Safety Stock Months) จากการตั้งค่าองค์กร
    SELECT COALESCE(safety_stock_months, 1)
    INTO v_safety_months
    FROM public.organization_info
    LIMIT 1;

    -- 5. คำนวณยอดแนะนำ (suggested_order_qty)
    -- สูตร: (อัตราใช้เฉลี่ยต่อเดือน * จำนวนเดือนที่ต้องการสำรอง) - ยอดคงคลังปัจจุบัน
    v_suggested := GREATEST(0, ROUND((v_avg * v_safety_months) - v_current_stock, 2));

    RETURN QUERY SELECT v_avg, v_suggested, v_last_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_usage_rate(UUID, INT) IS 'คำนวณอัตราการจ่ายยาเฉลี่ยต่อเดือนและยอดแนะนำเบิก โดยคัดกรองรายการโมฆะ, ขอบเขตวันที่, และใช้ ABS(qty) รองรับค่าลบ';
