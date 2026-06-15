-- =========================================================================
-- Schema Update: Add get_active_product_ids RPC function (Check doc_date)
-- วัตถุประสงค์: ปรับการตรวจสอบยึดตาม sm.doc_date (วันที่ในเอกสาร) แทน sm.created_at (วันที่ทำรายการ/นำเข้า)
-- เพื่อให้ประวัติการจ่ายยาที่นำเข้าย้อนหลัง แสดงผล Dead Stock ได้ถูกต้องตามความเป็นจริง
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_active_product_ids(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_movement_type TEXT DEFAULT 'ISSUE'
)
RETURNS TABLE (
    product_id UUID,
    total_qty NUMERIC,
    generic_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        smi.product_id,
        SUM(smi.qty)::NUMERIC as total_qty,
        MAX(p.generic_name)::TEXT as generic_name
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    JOIN public.products p ON smi.product_id = p.id
    WHERE sm.movement_type::TEXT = p_movement_type
      AND sm.is_voided = false
      -- เปลี่ยนมาเช็ควันที่ในเอกสาร (doc_date) แทนวันที่สร้างเรคอร์ด (created_at)
      AND (p_start_date IS NULL OR sm.doc_date >= p_start_date::DATE)
      AND (p_end_date IS NULL OR sm.doc_date <= p_end_date::DATE)
    GROUP BY smi.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- เคลียร์ Cache ของ PostgREST เพื่ออัปเดตโครงสร้าง
NOTIFY pgrst, 'reload schema';
