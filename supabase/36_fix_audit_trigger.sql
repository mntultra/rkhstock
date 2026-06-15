-- Migration 36: Fix process_stock_balance_audit trigger column reference
-- ปัญหา: ฟังก์ชัน trigger `process_stock_balance_audit` ใน migration 32 มีการอ้างอิง `smi.lot_number` ซึ่งไม่มีอยู่แล้วในตาราง `stock_movement_items` ทำให้เกิด error `column smi.lot_number does not exist`
-- การแก้ไข: เปลี่ยนการเปรียบเทียบจาก `smi.lot_number = v_lot_number` ให้เป็น `smi.lot_id = v_lot_id`

CREATE OR REPLACE FUNCTION public.process_stock_balance_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_qty_before INTEGER := 0;
    v_qty_after INTEGER := 0;
    v_qty_change INTEGER := 0;
    
    v_product_id UUID;
    v_warehouse_id UUID;
    v_lot_number VARCHAR(100);
    v_lot_id UUID;
    
    v_movement_id UUID := NULL;
    v_action_type public.stock_audit_action := 'CORRECTION';
    v_performed_by UUID := NULL;
BEGIN
    -- กรองประเภท Event และประเมินค่าก่อน/หลัง
    IF (TG_OP = 'INSERT') THEN
        v_qty_before := 0;
        v_qty_after := NEW.current_qty;
        
        v_product_id := NEW.product_id;
        v_warehouse_id := NEW.warehouse_id;
        v_lot_number := NEW.lot_number;
        v_lot_id := NEW.lot_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_qty_before := OLD.current_qty;
        v_qty_after := NEW.current_qty;
        
        v_product_id := NEW.product_id;
        v_warehouse_id := NEW.warehouse_id;
        v_lot_number := NEW.lot_number;
        v_lot_id := NEW.lot_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_qty_before := OLD.current_qty;
        v_qty_after := 0;
        
        v_product_id := OLD.product_id;
        v_warehouse_id := OLD.warehouse_id;
        v_lot_number := OLD.lot_number;
        v_lot_id := OLD.lot_id;
    END IF;

    -- คำนวณปริมาณที่เปลี่ยนแปลง
    v_qty_change := v_qty_after - v_qty_before;

    -- ถ้าไม่มีการเปลี่ยนจำนวนสต๊อก ให้ข้ามการบันทึก
    IF (v_qty_change = 0) THEN
        RETURN NULL;
    END IF;

    -- ตรวจสอบผู้ทำการแก้ไขผ่าน Supabase Auth Session
    v_performed_by := auth.uid();

    -- [Smart Tracing Fallback]
    BEGIN
        v_movement_id := NULLIF(current_setting('app.current_movement_id', true), '')::UUID;
        v_action_type := NULLIF(current_setting('app.current_movement_type', true), '')::public.stock_audit_action;
    EXCEPTION WHEN OTHERS THEN
        v_movement_id := NULL;
    END;

    -- หากไม่มีการระบุตัวแปรใน Session ให้ค้นหาแบบ Tracing ย้อนหลังจาก Transaction Log ล่าสุดของผลิตภัณฑ์/ล็อตนี้
    IF (v_movement_id IS NULL) THEN
        -- ค้นหารายการ Void ล่าสุดที่มีการประมวลผลในช่วงเวลาปัจจุบัน (ไม่เกิน 3 วินาทีย้อนหลัง)
        SELECT smi.movement_id, 'VOID'::public.stock_audit_action, sm.created_by
        INTO v_movement_id, v_action_type, v_performed_by
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE smi.product_id = v_product_id 
          AND smi.lot_id = v_lot_id
          AND smi.deleted_at >= (now() - interval '3 seconds')
        ORDER BY smi.deleted_at DESC
        LIMIT 1;

        -- หากไม่ใช่การ Void ให้ค้นหาการรับเข้า/จ่ายออก ล่าสุดที่เพิ่งอินเสิร์ตในทรานแซกชันนี้
        IF (v_movement_id IS NULL) THEN
            SELECT smi.movement_id, 
                   (CASE WHEN sm.movement_type = 'RECEIVE' THEN 'RECEIVE'::public.stock_audit_action 
                         WHEN sm.movement_type = 'ISSUE' THEN 'ISSUE'::public.stock_audit_action
                         WHEN sm.movement_type = 'DISPOSE' THEN 'DISPOSE'::public.stock_audit_action
                         ELSE 'ADJUST'::public.stock_audit_action 
                    END),
                   COALESCE(auth.uid(), sm.created_by)
            INTO v_movement_id, v_action_type, v_performed_by
            FROM public.stock_movement_items smi
            JOIN public.stock_movements sm ON smi.movement_id = sm.id
            WHERE smi.product_id = v_product_id 
              AND smi.lot_id = v_lot_id
              AND smi.created_at >= (now() - interval '3 seconds')
              AND smi.deleted_at IS NULL
            ORDER BY smi.created_at DESC
            LIMIT 1;
        END IF;
    END IF;

    -- หากสืบหาประวัติทำรายการไม่พบ ให้จัดประเภทตามปริมาณความเคลื่อนไหว (Direct Adjustments)
    IF (v_movement_id IS NULL) THEN
        v_performed_by := COALESCE(auth.uid(), v_performed_by);
        IF (TG_OP = 'INSERT') THEN
            v_action_type := 'RECEIVE'; -- การปรับเพิ่มล็อตใหม่โดยตรง
        ELSIF (TG_OP = 'UPDATE') THEN
            IF (v_qty_change > 0) THEN
                v_action_type := 'CORRECTION'; -- ปรับยอดเพิ่มหน้าตาราง
            ELSE
                v_action_type := 'ADJUST'; -- ปรับยอดลดหน้าตาราง
            END IF;
        ELSIF (TG_OP = 'DELETE') THEN
            v_action_type := 'ADJUST'; -- ลบสต๊อกล็อตออก
        END IF;
    END IF;

    -- บันทึกประวัติการตรวจสอบลงใน Immutable Audit Log Table
    INSERT INTO public.stock_audit_logs (
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
