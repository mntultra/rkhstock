-- =========================================================================
-- Schema for Borrow and Return System (ระบบยืม-คืนเวชภัณฑ์)
-- รบกวนนำสคริปต์นี้ไปรันใน Supabase SQL Editor
-- =========================================================================

-- 1. สร้างตารางบันทึกการยืม (borrowings)
CREATE TABLE IF NOT EXISTS borrowings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    borrower_id UUID NOT NULL REFERENCES staffs(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL, -- คลังที่ให้ยืม
    borrowed_qty INTEGER NOT NULL CHECK (borrowed_qty > 0),
    returned_qty INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'COMPLETED')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. สร้าง Function และ Trigger เพื่ออัปเดต updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_borrowings_modtime
    BEFORE UPDATE ON borrowings
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 3. เปิด RLS
ALTER TABLE borrowings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for authenticated users on borrowings" 
ON borrowings FOR ALL TO authenticated USING (true);

-- 4. แก้ไข Trigger ฟังก์ชันของ stock_audit_logs (เพื่อให้รู้จัก BORROW และ RETURN)
-- บรรทัดที่ 124 ในฟังก์ชัน process_stock_balance_audit() เดิม ให้แก้เป็นดังนี้
CREATE OR REPLACE FUNCTION process_stock_balance_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_qty_before INTEGER := 0;
    v_qty_after INTEGER := 0;
    v_qty_change INTEGER := 0;
    
    v_product_id UUID;
    v_warehouse_id UUID;
    v_lot_number VARCHAR(100);
    
    v_movement_id UUID := NULL;
    v_action_type stock_audit_action := 'CORRECTION';
    v_performed_by UUID := NULL;
BEGIN
    -- กรองประเภท Event และประเมินค่าก่อน/หลัง
    IF (TG_OP = 'INSERT') THEN
        v_qty_before := 0;
        v_qty_after := NEW.current_qty;
        v_product_id := NEW.product_id;
        v_warehouse_id := NEW.warehouse_id;
        v_lot_number := NEW.lot_number;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_qty_before := OLD.current_qty;
        v_qty_after := NEW.current_qty;
        v_product_id := NEW.product_id;
        v_warehouse_id := NEW.warehouse_id;
        v_lot_number := NEW.lot_number;
    ELSIF (TG_OP = 'DELETE') THEN
        v_qty_before := OLD.current_qty;
        v_qty_after := 0;
        v_product_id := OLD.product_id;
        v_warehouse_id := OLD.warehouse_id;
        v_lot_number := OLD.lot_number;
    END IF;

    -- คำนวณปริมาณที่เปลี่ยนแปลง
    v_qty_change := v_qty_after - v_qty_before;

    -- ถ้าไม่มีการเปลี่ยนจำนวนสต๊อก ให้ข้ามการบันทึก
    IF (v_qty_change = 0) THEN
        RETURN NULL;
    END IF;

    v_performed_by := auth.uid();

    BEGIN
        v_movement_id := NULLIF(current_setting('app.current_movement_id', true), '')::UUID;
        v_action_type := NULLIF(current_setting('app.current_movement_type', true), '')::stock_audit_action;
    EXCEPTION WHEN OTHERS THEN
        v_movement_id := NULL;
    END;

    IF (v_movement_id IS NULL) THEN
        -- ค้นหารายการ Void ล่าสุด
        SELECT smi.movement_id, 'VOID'::stock_audit_action, sm.created_by
        INTO v_movement_id, v_action_type, v_performed_by
        FROM stock_movement_items smi
        JOIN stock_movements sm ON smi.movement_id = sm.id
        WHERE smi.product_id = v_product_id 
          AND smi.lot_number = v_lot_number
          AND smi.deleted_at >= (now() - interval '3 seconds')
        ORDER BY smi.deleted_at DESC
        LIMIT 1;

        -- ค้นหาการเบิก/รับเข้า ล่าสุด
        IF (v_movement_id IS NULL) THEN
            SELECT smi.movement_id, 
                   (CASE WHEN sm.movement_type IN ('RECEIVE', 'RETURN') THEN 'RECEIVE'::stock_audit_action 
                         WHEN sm.movement_type IN ('ISSUE', 'BORROW') THEN 'ISSUE'::stock_audit_action
                         ELSE 'ADJUST'::stock_audit_action 
                    END),
                   COALESCE(auth.uid(), sm.created_by)
            INTO v_movement_id, v_action_type, v_performed_by
            FROM stock_movement_items smi
            JOIN stock_movements sm ON smi.movement_id = sm.id
            WHERE smi.product_id = v_product_id 
              AND smi.lot_number = v_lot_number
              AND smi.created_at >= (now() - interval '3 seconds')
              AND smi.deleted_at IS NULL
            ORDER BY smi.created_at DESC
            LIMIT 1;
        END IF;
    END IF;

    IF (v_movement_id IS NULL) THEN
        v_performed_by := COALESCE(auth.uid(), v_performed_by);
        IF (TG_OP = 'INSERT') THEN
            v_action_type := 'RECEIVE';
        ELSIF (TG_OP = 'UPDATE') THEN
            IF (v_qty_change > 0) THEN
                v_action_type := 'CORRECTION';
            ELSE
                v_action_type := 'ADJUST';
            END IF;
        ELSIF (TG_OP = 'DELETE') THEN
            v_action_type := 'ADJUST';
        END IF;
    END IF;

    INSERT INTO stock_audit_logs (
        action_type, product_id, warehouse_id, lot_number,
        qty_before, qty_change, qty_after, movement_id, performed_by
    ) VALUES (
        v_action_type, v_product_id, v_warehouse_id, v_lot_number,
        v_qty_before, v_qty_change, v_qty_after, v_movement_id, v_performed_by
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
