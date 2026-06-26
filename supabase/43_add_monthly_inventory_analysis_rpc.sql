-- =========================================================================
-- Schema Update: Add get_monthly_inventory_analysis RPC function
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_monthly_inventory_analysis(
    p_period_month DATE,
    p_usage_months INT DEFAULT 3
)
RETURNS TABLE (
    product_id UUID,
    drug_code TEXT,
    generic_name TEXT,
    unit_name TEXT,
    period_month DATE,
    ending_stock NUMERIC,
    unit_price NUMERIC,
    stock_value NUMERIC,
    total_issued NUMERIC,
    avg_monthly_usage NUMERIC,
    months_of_stock NUMERIC
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
    v_usage_start DATE;
BEGIN
    v_period_start := date_trunc('month', p_period_month)::DATE;
    v_period_end := (v_period_start + INTERVAL '1 month - 1 day')::DATE;
    v_usage_start := (v_period_end - (p_usage_months || ' month')::INTERVAL + INTERVAL '1 day')::DATE;

    RETURN QUERY
    WITH product_stock AS (
        SELECT 
            smi.product_id,
            SUM(
                CASE 
                    WHEN sm.movement_type::TEXT = 'RECEIVE' THEN smi.qty
                    WHEN sm.movement_type::TEXT = 'ISSUE' THEN -ABS(smi.qty)
                    ELSE 0 
                END
            )::NUMERIC as ending_stock
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE COALESCE(sm.is_voided, false) = false
          AND sm.doc_date <= v_period_end
        GROUP BY smi.product_id
    ),
    product_issues AS (
        SELECT 
            smi.product_id,
            SUM(ABS(smi.qty))::NUMERIC as total_issued
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE sm.movement_type::TEXT = 'ISSUE'
          AND COALESCE(sm.is_voided, false) = false
          AND sm.doc_date >= v_usage_start
          AND sm.doc_date <= v_period_end
        GROUP BY smi.product_id
    )
    SELECT 
        p.id as product_id,
        COALESCE(p.drug_code, '')::TEXT as drug_code,
        p.generic_name::TEXT as generic_name,
        COALESCE(mu.unit_name, 'ชิ้น')::TEXT as unit_name,
        v_period_start as period_month,
        COALESCE(ps.ending_stock, 0)::NUMERIC as ending_stock,
        COALESCE(p.unit_price, 0)::NUMERIC as unit_price,
        (COALESCE(ps.ending_stock, 0) * COALESCE(p.unit_price, 0))::NUMERIC as stock_value,
        COALESCE(pi.total_issued, 0)::NUMERIC as total_issued,
        ROUND((COALESCE(pi.total_issued, 0) / p_usage_months), 2)::NUMERIC as avg_monthly_usage,
        CASE 
            WHEN COALESCE(pi.total_issued, 0) = 0 THEN 999.99::NUMERIC
            ELSE ROUND((COALESCE(ps.ending_stock, 0) / (COALESCE(pi.total_issued, 0) / p_usage_months)), 2)::NUMERIC
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
