-- =========================================================================
-- Schema Update: Add get_inventory_analysis RPC function
-- วัตถุประสงค์: คำนวณหาปริมาณคงคลัง มูลค่าคงคลัง และอัตราการสำรองคลังรายเวชภัณฑ์
-- ในรอบ p_months เดือน เพื่อใช้สำหรับการประเมินสภาพคล่องและจุดจมของสต๊อก
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_inventory_analysis(
    p_months INT
)
RETURNS TABLE (
    product_id UUID,
    drug_code TEXT,
    generic_name TEXT,
    unit_name TEXT,
    current_stock NUMERIC,
    unit_price NUMERIC,
    stock_value NUMERIC,
    total_issued NUMERIC,
    avg_monthly_usage NUMERIC,
    months_of_stock NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH product_stock AS (
        -- คำนวณสต๊อกคงเหลือรายเวชภัณฑ์ (เฉพาะคลังควบคุมที่ยังไม่ลบ)
        SELECT 
            sb.product_id,
            SUM(sb.current_qty)::NUMERIC as current_stock,
            -- ราคาเฉลี่ยของล็อตคงเหลือปัจจุบัน
            COALESCE(AVG(sb.unit_price), 0)::NUMERIC as avg_unit_price
        FROM public.stock_balances sb
        WHERE sb.deleted_at IS NULL
        GROUP BY sb.product_id
    ),
    product_issues AS (
        -- คำนวณยอดการจ่ายออก (ISSUE) ย้อนหลัง p_months เดือน
        SELECT 
            smi.product_id,
            SUM(smi.qty)::NUMERIC as total_issued
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE sm.movement_type::TEXT = 'ISSUE'
          AND COALESCE(sm.is_voided, false) = false
          AND sm.doc_date >= CURRENT_DATE - (p_months || ' month')::INTERVAL
          AND sm.doc_date <= CURRENT_DATE
        GROUP BY smi.product_id
    )
    SELECT 
        p.id as product_id,
        COALESCE(p.drug_code, '')::TEXT as drug_code,
        p.generic_name::TEXT as generic_name,
        COALESCE(mu.unit_name, 'ชิ้น')::TEXT as unit_name,
        COALESCE(ps.current_stock, 0)::NUMERIC as current_stock,
        COALESCE(ps.avg_unit_price, p.unit_price, 0)::NUMERIC as unit_price,
        (COALESCE(ps.current_stock, 0) * COALESCE(ps.avg_unit_price, p.unit_price, 0))::NUMERIC as stock_value,
        COALESCE(pi.total_issued, 0)::NUMERIC as total_issued,
        ROUND((COALESCE(pi.total_issued, 0) / p_months), 2)::NUMERIC as avg_monthly_usage,
        CASE 
            WHEN COALESCE(pi.total_issued, 0) = 0 THEN 999.99::NUMERIC -- หากไม่มีการจ่ายออกเลยในช่วงเวลาที่กำหนด
            ELSE ROUND((COALESCE(ps.current_stock, 0) / (COALESCE(pi.total_issued, 0) / p_months)), 2)::NUMERIC
        END as months_of_stock
    FROM public.products p
    LEFT JOIN public.master_units mu ON p.unit_id = mu.id
    LEFT JOIN product_stock ps ON p.id = ps.product_id
    LEFT JOIN product_issues pi ON p.id = pi.product_id
    WHERE p.is_active = true
    ORDER BY p.generic_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- เคลียร์ Cache ของ PostgREST
NOTIFY pgrst, 'reload schema';
