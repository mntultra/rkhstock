-- 1. เพิ่มคอลัมน์สำหรับการ Void ใน stock_movements
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

-- 2. สร้าง RPC สำหรับการ Void บิล
CREATE OR REPLACE FUNCTION void_stock_movement(p_movement_id UUID, p_user_id UUID)
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
BEGIN
    -- 1. Check if movement exists and get details
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
    
    -- 2. Validate and Revert Stock Balances
    FOR item IN SELECT * FROM stock_movement_items WHERE movement_id = p_movement_id LOOP
        IF v_movement_type = 'RECEIVE' THEN
            -- To void a receive, we must DEDUCT from stock_balances.
            SELECT current_qty INTO v_current_qty
            FROM stock_balances
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_number = item.lot_number;
              
            IF v_current_qty IS NULL OR v_current_qty < item.qty THEN
                RAISE EXCEPTION 'ไม่สามารถยกเลิกได้: เนื่องจากเวชภัณฑ์ล็อต % ได้ถูกจ่ายออกไปแล้วและยอดคงเหลือไม่เพียงพอสำหรับการดึงคืน', item.lot_number;
            END IF;
            
            UPDATE stock_balances
            SET current_qty = current_qty - item.qty
            WHERE product_id = item.product_id 
              AND warehouse_id = v_to_warehouse_id
              AND lot_number = item.lot_number;
              
        ELSIF v_movement_type IN ('ISSUE', 'DISPOSE') THEN
            -- To void issue/dispose, we must ADD back to stock_balances. (qty in items is negative)
            UPDATE stock_balances
            SET current_qty = current_qty + ABS(item.qty)
            WHERE product_id = item.product_id 
              AND warehouse_id = v_from_warehouse_id
              AND lot_number = item.lot_number;
        END IF;
    END LOOP;
    
    -- 3. Mark as voided
    UPDATE stock_movements
    SET is_voided = TRUE,
        voided_at = NOW(),
        voided_by = p_user_id
    WHERE id = p_movement_id;
    
    -- 4. Revert requisition status if applicable
    IF v_movement_type = 'RECEIVE' AND v_requisition_id IS NOT NULL THEN
        UPDATE requisitions SET status = 'PENDING' WHERE id = v_requisition_id;
        UPDATE requisition_items SET received_qty = 0, receive_remark = NULL WHERE requisition_id = v_requisition_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- 3. สร้าง RPC สำหรับการรับเข้าเวชภัณฑ์อย่างปลอดภัย
CREATE OR REPLACE FUNCTION add_stock_balance(
    p_product_id UUID, 
    p_warehouse_id UUID, 
    p_lot_number VARCHAR, 
    p_expiry_date DATE,
    p_qty INTEGER,
    p_unit_price NUMERIC DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_qty INTEGER;
BEGIN
    -- Check if record exists
    SELECT current_qty INTO v_current_qty
    FROM stock_balances
    WHERE product_id = p_product_id 
      AND warehouse_id = p_warehouse_id 
      AND lot_number = p_lot_number;
      
    IF FOUND THEN
        -- Update
        UPDATE stock_balances 
        SET current_qty = current_qty + p_qty,
            unit_price = CASE WHEN p_unit_price > 0 THEN p_unit_price ELSE unit_price END,
            expiry_date = CASE WHEN p_expiry_date IS NOT NULL THEN p_expiry_date ELSE expiry_date END
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_number = p_lot_number;
    ELSE
        -- Insert
        INSERT INTO stock_balances (product_id, warehouse_id, lot_number, expiry_date, current_qty, unit_price)
        VALUES (p_product_id, p_warehouse_id, p_lot_number, p_expiry_date, p_qty, p_unit_price);
    END IF;
    
    RETURN TRUE;
END;
$$;
