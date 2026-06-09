BEGIN;

-- ==========================================
-- 1. ฟังก์ชันอัตโนมัติสำหรับ Find or Create Lot (Trigger)
-- ==========================================
CREATE OR REPLACE FUNCTION public.trg_assign_lot_id()
RETURNS TRIGGER AS $$
DECLARE
    v_lot_id UUID;
    v_normalized_lot VARCHAR;
BEGIN
    -- ถ้า Frontend ยังส่งแต่ข้อมูลเก่า (ยังไม่ส่ง lot_id)
    IF NEW.lot_id IS NULL THEN
        -- จัดการค่าว่างให้กลายเป็น '-'
        v_normalized_lot := COALESCE(NULLIF(TRIM(NEW.lot_number), ''), '-');
        
        -- ค้นหาหรือสร้าง Lot ใหม่ (Upsert)
        INSERT INTO public.lots (product_id, lot_number, expiry_date, unit_price)
        VALUES (NEW.product_id, v_normalized_lot, NEW.expiry_date, COALESCE(NEW.unit_price, 0))
        ON CONFLICT (product_id, lot_number, COALESCE(expiry_date, '9999-12-31'::DATE))
        DO UPDATE SET unit_price = EXCLUDED.unit_price
        RETURNING id INTO v_lot_id;
        
        -- จับคู่ lot_id ที่ได้กลับเข้าไป
        NEW.lot_id := v_lot_id;
        NEW.lot_number := v_normalized_lot;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger เข้ากับประวัติการทำรายการ (stock_movement_items)
DROP TRIGGER IF EXISTS trg_assign_lot_id_before_insert ON public.stock_movement_items;
CREATE TRIGGER trg_assign_lot_id_before_insert
BEFORE INSERT ON public.stock_movement_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_assign_lot_id();

-- ผูก Trigger เข้ากับยอดสต๊อก (stock_balances) เผื่อกรณีบันทึกแมนวล
DROP TRIGGER IF EXISTS trg_assign_lot_id_before_insert_sb ON public.stock_balances;
CREATE TRIGGER trg_assign_lot_id_before_insert_sb
BEFORE INSERT ON public.stock_balances
FOR EACH ROW
EXECUTE FUNCTION public.trg_assign_lot_id();


-- ==========================================
-- 2. อัปเดต RPC (add_stock_balance) 
-- ==========================================
CREATE OR REPLACE FUNCTION public.add_stock_balance(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_lot_number VARCHAR,
    p_expiry_date DATE,
    p_unit_price NUMERIC,
    p_qty NUMERIC
) RETURNS void AS $$
DECLARE
    v_lot_id UUID;
    v_normalized_lot VARCHAR;
BEGIN
    v_normalized_lot := COALESCE(NULLIF(TRIM(p_lot_number), ''), '-');

    -- 1. Find or Create Lot
    INSERT INTO public.lots (product_id, lot_number, expiry_date, unit_price)
    VALUES (p_product_id, v_normalized_lot, p_expiry_date, COALESCE(p_unit_price, 0))
    ON CONFLICT (product_id, lot_number, COALESCE(expiry_date, '9999-12-31'::DATE))
    DO UPDATE SET unit_price = EXCLUDED.unit_price
    RETURNING id INTO v_lot_id;
    
    -- 2. Upsert into stock_balances (อ้างอิง lot_id)
    IF EXISTS (
        SELECT 1 FROM public.stock_balances 
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_id = v_lot_id
    ) THEN
        UPDATE public.stock_balances
        SET current_qty = current_qty + p_qty,
            unit_price = COALESCE(p_unit_price, unit_price),
            lot_number = v_normalized_lot,
            expiry_date = p_expiry_date
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_id = v_lot_id;
    ELSE
        INSERT INTO public.stock_balances (
            product_id, warehouse_id, lot_id, lot_number, expiry_date, unit_price, current_qty
        ) VALUES (
            p_product_id, p_warehouse_id, v_lot_id, v_normalized_lot, p_expiry_date, COALESCE(p_unit_price, 0), p_qty
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 3. อัปเดต RPC (deduct_stock_balance) 
-- ==========================================
-- เพิ่มตัวเลือกให้รับ expiry_date เข้ามาด้วยได้เพื่อความแม่นยำ 100%
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
        UPDATE public.stock_balances
        SET current_qty = current_qty - p_qty
        WHERE product_id = p_product_id 
          AND warehouse_id = p_warehouse_id 
          AND lot_id = v_lot_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
