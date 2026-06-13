-- =========================================================================
-- Migration 24: Fix void_stock_movement for Lot-based Architecture
-- Run this in Supabase SQL Editor
-- =========================================================================

CREATE OR REPLACE FUNCTION public.void_stock_movement(p_movement_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_movement_type VARCHAR;
    v_from_warehouse_id UUID;
    v_to_warehouse_id UUID;
    v_is_voided BOOLEAN;
    v_requisition_id UUID;
    item RECORD;
    v_current_qty INTEGER;
    v_lot_number VARCHAR;
BEGIN
    -- 1. ตรวจสอบว่า Movement มีอยู่จริงและยังไม่ถูก Void
    SELECT movement_type, from_warehouse_id, to_warehouse_id, is_voided, requisition_id 
    INTO v_movement_type, v_from_warehouse_id, v_to_warehouse_id, v_is_voided, v_requisition_id
    FROM stock_movements
    WHERE id = p_movement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement % not found', p_movement_id;
    END IF;

    IF v_is_voided THEN
        RAISE EXCEPTION 'Movement % is already voided', p_movement_id;
    END IF;
    
    -- 2. วนลูปผ่านแต่ละรายการ และคืนยอดสต๊อกกลับ
    --    JOIN กับตาราง lots เพื่อดึง lot_number (ไม่ใช้จาก smi.lot_number ที่ถูกลบไปแล้ว)
    FOR item IN 
        SELECT smi.*, l.lot_number 
        FROM stock_movement_items smi
        LEFT JOIN lots l ON smi.lot_id = l.id
        WHERE smi.movement_id = p_movement_id 
    LOOP
        v_lot_number := COALESCE(item.lot_number, '-');
        
        IF v_movement_type = 'RECEIVE' THEN
            -- การ Void ใบรับ: ต้องหักสต๊อกคืน (ตรวจสอบว่าพอหักหรือไม่)
            SELECT current_qty INTO v_current_qty
            FROM stock_balances
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_id = item.lot_id;
              
            IF v_current_qty IS NULL OR v_current_qty < item.qty THEN
                RAISE EXCEPTION 'ไม่สามารถยกเลิกได้: เวชภัณฑ์ล็อต "%" ถูกจ่ายออกไปแล้ว ยอดคงเหลือไม่เพียงพอสำหรับการดึงคืน (มีอยู่: %, ต้องการดึงคืน: %)', 
                    v_lot_number, COALESCE(v_current_qty, 0), item.qty;
            END IF;
            
            UPDATE stock_balances
            SET current_qty = current_qty - item.qty
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_id = item.lot_id;
              
        ELSIF v_movement_type IN ('DISPENSE', 'DISPOSE') THEN
            -- การ Void ใบจ่าย/ใบทำลาย: ต้องบวกสต๊อกคืน
            IF EXISTS (
                SELECT 1 FROM stock_balances 
                WHERE product_id = item.product_id 
                  AND warehouse_id = v_from_warehouse_id
                  AND lot_id = item.lot_id
            ) THEN
                -- มีแถวอยู่แล้ว → UPDATE เพิ่มยอด
                UPDATE stock_balances
                SET current_qty = current_qty + ABS(item.qty)
                WHERE product_id = item.product_id 
                  AND warehouse_id = v_from_warehouse_id
                  AND lot_id = item.lot_id;
            ELSE
                -- ไม่มีแถว (อาจถูกลบหลังจ่ายจนหมด) → INSERT ใหม่
                INSERT INTO stock_balances (product_id, warehouse_id, lot_id, lot_number, expiry_date, unit_price, current_qty)
                SELECT 
                    item.product_id, 
                    v_from_warehouse_id, 
                    item.lot_id, 
                    l.lot_number, 
                    l.expiry_date, 
                    l.unit_price, 
                    ABS(item.qty)
                FROM lots l
                WHERE l.id = item.lot_id;
            END IF;
        END IF;
    END LOOP;
    
    -- 3. Mark Movement ว่าถูก Void แล้ว
    UPDATE stock_movements
    SET 
        is_voided = TRUE,
        voided_at = NOW(),
        voided_by = p_user_id
    WHERE id = p_movement_id;
    
    -- 4. หากเป็นการ Void ใบรับที่อ้างถึงใบขอเบิก → คืนสถานะใบขอเบิกด้วย
    IF v_movement_type = 'RECEIVE' AND v_requisition_id IS NOT NULL THEN
        UPDATE requisitions 
        SET status = 'PENDING' 
        WHERE id = v_requisition_id;
        
        UPDATE requisition_items 
        SET received_qty = 0, receive_remark = NULL 
        WHERE requisition_id = v_requisition_id;
    END IF;

    RETURN TRUE;
END;
$$;
