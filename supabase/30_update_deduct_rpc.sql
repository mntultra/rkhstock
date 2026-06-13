-- =========================================================================
-- Migration 30: Update deduct_stock_balance RPC to prevent negative stock
-- รบกวนนำสคริปต์นี้ไปรันใน Supabase SQL Editor
-- =========================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.deduct_stock_balance(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_lot_number VARCHAR,
    p_qty NUMERIC,
    p_expiry_date DATE DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_lot_id UUID;
    v_normalized_lot VARCHAR;
    v_current_qty NUMERIC;
BEGIN
    v_normalized_lot := COALESCE(NULLIF(TRIM(p_lot_number), ''), '-');

    -- ค้นหา Lot ที่มีอยู่
    IF p_expiry_date IS NOT NULL THEN
        SELECT id INTO v_lot_id 
        FROM public.lots 
        WHERE product_id = p_product_id 
          AND lot_number = v_normalized_lot 
          AND expiry_date = p_expiry_date
        LIMIT 1;
    ELSE
        SELECT id INTO v_lot_id 
        FROM public.lots 
        WHERE product_id = p_product_id 
          AND lot_number = v_normalized_lot
        LIMIT 1;
    END IF;
    
    -- หักสต๊อกผ่าน lot_id ที่เจอ
    IF v_lot_id IS NOT NULL THEN
        -- เช็คยอดปัจจุบันก่อนหัก
        SELECT current_qty INTO v_current_qty
        FROM public.stock_balances
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_id = v_lot_id;
          
        IF v_current_qty IS NULL OR v_current_qty < p_qty THEN
            RAISE EXCEPTION 'ยอดคงเหลือในคลังไม่เพียงพอ (คงเหลือ: %, ต้องการหัก: %)', COALESCE(v_current_qty, 0), p_qty;
        END IF;

        UPDATE public.stock_balances
        SET current_qty = current_qty - p_qty
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_id = v_lot_id;
    ELSE
        RAISE EXCEPTION 'ไม่พบข้อมูล Lot % สำหรับหักสต๊อก', v_normalized_lot;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
