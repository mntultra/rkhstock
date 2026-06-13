-- =========================================================================
-- Migration 29: Update Void RPC & Add borrowing_id to stock_movements
-- รบกวนนำสคริปต์นี้ไปรันใน Supabase SQL Editor
-- =========================================================================

BEGIN;

-- 1. เพิ่มคอลัมน์เพื่อเชื่อมโยงประวัติการยืม-คืน
-- 1.1 สำหรับการยืม (BORROW) -> ใบยืม 1 ใบอ้างอิงถึงการเคลื่อนไหว 1 ครั้ง
ALTER TABLE public.borrowings
ADD COLUMN IF NOT EXISTS movement_id UUID REFERENCES public.stock_movements(id);

-- 1.2 สำหรับการรับคืน (RETURN) -> การเคลื่อนไหว (รับคืน) อ้างอิงกลับไปยังใบยืม
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS borrowing_id UUID REFERENCES public.borrowings(id);

COMMENT ON COLUMN public.stock_movements.borrowing_id IS 'ใช้อ้างอิงกลับไปยังรายการยืมเวชภัณฑ์ในกรณีที่เป็น movement ประเภท RETURN';
COMMENT ON COLUMN public.borrowings.movement_id IS 'ใช้อ้างอิงการทำรายการยืมออก (BORROW)';

-- 2. อัปเดตฟังก์ชัน void_stock_movement ให้รองรับ ADJUST, BORROW, RETURN
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
    v_borrowing_id UUID;
    item RECORD;
    v_current_qty INTEGER;
    v_lot_number VARCHAR;
BEGIN
    -- ตรวจสอบว่า Movement มีอยู่จริงและยังไม่ถูก Void
    SELECT movement_type, from_warehouse_id, to_warehouse_id, is_voided, requisition_id, borrowing_id
    INTO v_movement_type, v_from_warehouse_id, v_to_warehouse_id, v_is_voided, v_requisition_id, v_borrowing_id
    FROM stock_movements
    WHERE id = p_movement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement % not found', p_movement_id;
    END IF;

    IF v_is_voided THEN
        RAISE EXCEPTION 'Movement % is already voided', p_movement_id;
    END IF;
    
    -- วนลูปผ่านแต่ละรายการ และคืนยอดสต๊อกกลับ
    FOR item IN 
        SELECT smi.*, l.lot_number, l.expiry_date, l.unit_price
        FROM stock_movement_items smi
        LEFT JOIN lots l ON smi.lot_id = l.id
        WHERE smi.movement_id = p_movement_id 
    LOOP
        v_lot_number := COALESCE(item.lot_number, '-');
        
        -- ====================================================================
        -- กรณี RECEIVE หรือ RETURN: คืนยอดโดยการ "หักสต๊อกออก"
        -- ====================================================================
        IF v_movement_type IN ('RECEIVE', 'RETURN') THEN
            SELECT current_qty INTO v_current_qty
            FROM stock_balances
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_id = item.lot_id;
              
            -- ต้องมียอดพอให้หักคืน
            IF v_current_qty IS NULL OR v_current_qty < ABS(item.qty) THEN
                RAISE EXCEPTION 'ไม่สามารถยกเลิกได้: เวชภัณฑ์ล็อต "%" ถูกนำไปใช้แล้ว ยอดคงเหลือไม่เพียงพอสำหรับการดึงคืน (มีอยู่: %, ต้องการดึงคืน: %)', 
                    v_lot_number, COALESCE(v_current_qty, 0), ABS(item.qty);
            END IF;
            
            UPDATE stock_balances
            SET current_qty = current_qty - ABS(item.qty)
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_id = item.lot_id;
              
        -- ====================================================================
        -- กรณี DISPENSE, DISPOSE หรือ BORROW: คืนยอดโดยการ "บวกสต๊อกกลับ"
        -- ====================================================================
        ELSIF v_movement_type IN ('DISPENSE', 'DISPOSE', 'BORROW') THEN
            IF EXISTS (
                SELECT 1 FROM stock_balances 
                WHERE product_id = item.product_id 
                  AND warehouse_id = v_from_warehouse_id
                  AND lot_id = item.lot_id
            ) THEN
                UPDATE stock_balances
                SET current_qty = current_qty + ABS(item.qty)
                WHERE product_id = item.product_id 
                  AND warehouse_id = v_from_warehouse_id
                  AND lot_id = item.lot_id;
            ELSE
                INSERT INTO stock_balances (product_id, warehouse_id, lot_id, lot_number, expiry_date, unit_price, current_qty)
                VALUES (item.product_id, v_from_warehouse_id, item.lot_id, v_lot_number, item.expiry_date, COALESCE(item.unit_price, 0), ABS(item.qty));
            END IF;
            
        -- ====================================================================
        -- กรณี ADJUST: บวก/ลบ ตรงข้ามกับสิ่งที่ทำไป
        -- qty บวก (เติมสต๊อก) -> หักออก (ลดกลับ)
        -- qty ลบ (ลดสต๊อก) -> บวกกลับ
        -- ====================================================================
        ELSIF v_movement_type = 'ADJUST' THEN
            SELECT current_qty INTO v_current_qty
            FROM stock_balances
            WHERE product_id = item.product_id 
              AND warehouse_id = COALESCE(v_to_warehouse_id, v_from_warehouse_id)
              AND lot_id = item.lot_id;
              
            -- หากเคยบวกยอดเข้า (item.qty > 0) เราต้องหักคืน จึงต้องเช็คว่าพอหักไหม
            IF item.qty > 0 AND (v_current_qty IS NULL OR v_current_qty < item.qty) THEN
                RAISE EXCEPTION 'ไม่สามารถยกเลิกได้: ยอดสต๊อกไม่พอให้ดึงคืน (มี %, ต้องการหักคืน %)', COALESCE(v_current_qty, 0), item.qty;
            END IF;
            
            IF v_current_qty IS NOT NULL THEN
                UPDATE stock_balances
                SET current_qty = current_qty - item.qty -- หักล้างกันเอง (-5 ก็จะกลายเป็น +5)
                WHERE product_id = item.product_id 
                  AND warehouse_id = COALESCE(v_to_warehouse_id, v_from_warehouse_id)
                  AND lot_id = item.lot_id;
            ELSE
                -- กรณีไม่มียอดอยู่เลย (แปลกมากสำหรับ Adjust แต่เผื่อไว้กรณี qty ติดลบแล้วเพิ่งสร้าง)
                INSERT INTO stock_balances (product_id, warehouse_id, lot_id, lot_number, expiry_date, unit_price, current_qty)
                VALUES (item.product_id, COALESCE(v_to_warehouse_id, v_from_warehouse_id), item.lot_id, v_lot_number, item.expiry_date, COALESCE(item.unit_price, 0), -item.qty);
            END IF;
        END IF;
    END LOOP;
    
    -- Mark Movement ว่าถูก Void แล้ว
    UPDATE stock_movements
    SET 
        is_voided = TRUE,
        voided_at = NOW(),
        voided_by = p_user_id
    WHERE id = p_movement_id;
    
    -- คืนสถานะการเชื่อมโยงอื่นๆ
    IF v_movement_type = 'RECEIVE' AND v_requisition_id IS NOT NULL THEN
        UPDATE requisitions SET status = 'PENDING' WHERE id = v_requisition_id;
        UPDATE requisition_items SET received_qty = 0, receive_remark = NULL WHERE requisition_id = v_requisition_id;
    END IF;

    IF v_movement_type = 'BORROW' THEN
        -- ถ้ายกเลิกการยืม ถือว่าใบยืมนั้นถูกยกเลิก (ยังไม่มีสถานะ CANCELLED แต่จะใช้ COMPLETED หรือ 0 คืนไปก่อน)
        UPDATE borrowings SET borrowed_qty = 0, status = 'COMPLETED' WHERE movement_id = p_movement_id;
    END IF;

    IF v_movement_type = 'RETURN' AND v_borrowing_id IS NOT NULL THEN
        -- ถ้ายกเลิกการคืน ต้องลด returned_qty ลง
        UPDATE borrowings 
        SET 
            returned_qty = GREATEST(0, returned_qty - (SELECT SUM(ABS(qty)) FROM stock_movement_items WHERE movement_id = p_movement_id)),
            status = 'PARTIAL' 
        WHERE id = v_borrowing_id;
        
        -- หากลดแล้วเหลือน้อยกว่าหรือเท่ากับ 0 ก็ให้กลับไปเป็น PENDING
        UPDATE borrowings SET status = 'PENDING' WHERE id = v_borrowing_id AND returned_qty <= 0;
    END IF;

    RETURN TRUE;
END;
$$;

COMMIT;
