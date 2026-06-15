-- =========================================================================
-- Schema Update: Rename Dispense to Issue
-- วัตถุประสงค์: เปลี่ยนการใช้งานคำว่า Dispense เป็น Issue ทั้งใน ENUM, Data และ Trigger
-- =========================================================================

-- 1. อัปเดต ENUM stock_audit_action (ถ้าใช้ Postgres 10+ สามารถทำได้เลย)
DO $$
BEGIN
    ALTER TYPE stock_audit_action RENAME VALUE 'DISPENSE' TO 'ISSUE';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not rename enum value DISPENSE to ISSUE (might not exist or already renamed)';
END
$$;

-- เพิ่ม DISPOSE (ทำลายยา) หากยังไม่มี
DO $$
BEGIN
    ALTER TYPE stock_audit_action ADD VALUE 'DISPOSE';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Value DISPOSE already exists in enum stock_audit_action';
END
$$;

-- 2. อัปเดต ENUM movement_type ของตาราง stock_movements
DO $$
BEGIN
    ALTER TYPE movement_type RENAME VALUE 'DISPENSE' TO 'ISSUE';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not rename enum value DISPENSE to ISSUE for movement_type';
END
$$;

-- เพิ่ม DISPOSE (ทำลายยา) ใน movement_type หากยังไม่มี (เผื่อไว้ในอนาคต)
DO $$
BEGIN
    ALTER TYPE movement_type ADD VALUE 'DISPOSE';
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Value DISPOSE already exists in enum movement_type';
END
$$;

-- เนื่องจากเราใช้ ALTER TYPE RENAME VALUE ข้อมูลในคอลัมน์ movement_type ที่เคยเป็น 'DISPENSE' จะกลายเป็น 'ISSUE' โดยอัตโนมัติ 
-- จึงไม่ต้องทำ UPDATE table SET movement_type = 'ISSUE' อีก

-- ปรับเลขเอกสารย้อนหลังจาก DIS เป็น ISS เฉพาะเอกสารประเภท ISSUE
UPDATE public.stock_movements
SET doc_no = REPLACE(doc_no, 'DIS', 'ISS')
WHERE movement_type = 'ISSUE' 
  AND doc_no LIKE 'DIS%';

-- 3. อัปเดต Trigger การสร้างเลขเอกสาร (generate_document_no) ให้ใช้ ISS และสงวน DIS ไว้สำหรับ DISPOSE
CREATE OR REPLACE FUNCTION public.generate_document_no()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    date_str TEXT;
    next_seq INTEGER;
    formatted_seq TEXT;
    target_date DATE;
BEGIN
    -- ใช้ doc_date เป็นหลักในการสร้างเลขเอกสารตามวันของเอกสาร
    target_date := COALESCE(NEW.doc_date, CURRENT_DATE);
    date_str := to_char(target_date, 'YYYYMMDD');

    -- กำหนดคำขึ้นต้นเอกสาร (Prefix)
    IF TG_TABLE_NAME = 'requisitions' THEN
        prefix := 'REQ';
    ELSIF TG_TABLE_NAME = 'stock_movements' THEN
        IF NEW.movement_type = 'RECEIVE' THEN
            prefix := 'REC';
        ELSIF NEW.movement_type = 'ISSUE' THEN
            prefix := 'ISS';
        ELSIF NEW.movement_type = 'DISPOSE' THEN
            prefix := 'DIS';
        ELSE
            -- สำหรับความเคลื่อนไหวอื่น ๆ เช่น ADJUST หรือ RETURN
            prefix := NEW.movement_type;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- หากมีเลขที่เอกสารส่งเข้ามาแล้วและไม่ใช่รูปแบบเก่า/ค่าว่าง ให้ใช้ค่าเดิมได้ (Manual Override)
    IF NEW.doc_no IS NOT NULL AND NEW.doc_no <> '' AND NEW.doc_no NOT LIKE 'RQ-%' THEN
        RETURN NEW;
    END IF;

    -- ค้นหาลำดับถัดไป (รันต่อกันเฉพาะในแต่ละวันของชนิดเอกสารนั้น ๆ)
    IF TG_TABLE_NAME = 'requisitions' THEN
        SELECT COALESCE(MAX(SUBSTRING(doc_no FROM '\d{8}-(\d{2})$')::INTEGER), 0) + 1
        INTO next_seq
        FROM public.requisitions
        WHERE doc_date = target_date
          AND doc_no LIKE prefix || date_str || '-%';
    ELSIF TG_TABLE_NAME = 'stock_movements' THEN
        SELECT COALESCE(MAX(SUBSTRING(doc_no FROM '\d{8}-(\d{2})$')::INTEGER), 0) + 1
        INTO next_seq
        FROM public.stock_movements
        WHERE doc_date = target_date
          AND movement_type = NEW.movement_type
          AND doc_no LIKE prefix || date_str || '-%';
    END IF;

    -- ฟอร์แมตเลขลำดับให้เป็น 2 หลัก (เช่น 01, 02)
    formatted_seq := LPAD(next_seq::TEXT, 2, '0');

    -- ประกอบตัวเลขเป็นเลขที่เอกสารใหม่
    NEW.doc_no := prefix || date_str || '-' || formatted_seq;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. อัปเดตกระบวนการทำ Audit Log ให้เปลี่ยนมารองรับ ISSUE
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

    -- 5.1 ตรวจสอบผู้ทำการแก้ไขผ่าน Supabase Auth Session
    v_performed_by := auth.uid();

    -- 5.2 [Smart Tracing Fallback]
    BEGIN
        v_movement_id := NULLIF(current_setting('app.current_movement_id', true), '')::UUID;
        v_action_type := NULLIF(current_setting('app.current_movement_type', true), '')::stock_audit_action;
    EXCEPTION WHEN OTHERS THEN
        v_movement_id := NULL;
    END;

    IF (v_movement_id IS NULL) THEN
        SELECT smi.movement_id, 'VOID'::stock_audit_action, sm.created_by
        INTO v_movement_id, v_action_type, v_performed_by
        FROM stock_movement_items smi
        JOIN stock_movements sm ON smi.movement_id = sm.id
        WHERE smi.product_id = v_product_id 
          AND smi.lot_number = v_lot_number
          AND smi.deleted_at >= (now() - interval '3 seconds')
        ORDER BY smi.deleted_at DESC
        LIMIT 1;

        IF (v_movement_id IS NULL) THEN
            SELECT smi.movement_id, 
                   (CASE WHEN sm.movement_type = 'RECEIVE' THEN 'RECEIVE'::stock_audit_action 
                         WHEN sm.movement_type = 'ISSUE' THEN 'ISSUE'::stock_audit_action
                         WHEN sm.movement_type = 'DISPOSE' THEN 'DISPOSE'::stock_audit_action
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
        action_type,
        product_id,
        warehouse_id,
        lot_number,
        qty_before,
        qty_change,
        qty_after,
        movement_id,
        performed_by
    ) VALUES (
        v_action_type,
        v_product_id,
        v_warehouse_id,
        v_lot_number,
        v_qty_before,
        v_qty_change,
        v_qty_after,
        v_movement_id,
        v_performed_by
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
