-- =========================================================================
-- Migration 25: Recalculate ALL stock_balances from movement history
-- และปรับปรุงแก้ไข process_stock_balance_audit trigger ให้ถูกต้องตามระบบ Lot-based
--
-- ปัญหา:
-- 1. การ Import ใบจ่ายประวัติ (ISSUE) ไม่ได้หักยอดออกจาก stock_balances หรือหักผิดล๊อต
-- 2. ฟังก์ชัน trigger `process_stock_balance_audit` เดิมยังอ้างอิง `smi.lot_number` ซึ่งไม่มีอยู่แล้ว
--
-- วิธีใช้: คัดลอกโค้ดทั้งหมดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. ปรับปรุงแก้ไขฟังก์ชัน trigger process_stock_balance_audit
-- ให้เปรียบเทียบด้วย lot_id แทน lot_number ในตาราง stock_movement_items
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_stock_balance_audit()
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
    -- ดึงข้อมูล Movement ID ล่าสุดของยานี้ในธุรกรรมปัจจุบัน
    BEGIN
        v_movement_id := NULLIF(current_setting('app.current_movement_id', true), '')::UUID;
        v_action_type := NULLIF(current_setting('app.current_movement_type', true), '')::stock_audit_action;
    EXCEPTION WHEN OTHERS THEN
        v_movement_id := NULL;
    END;

    -- หากไม่มีการระบุตัวแปรใน Session ให้ค้นหาแบบ Tracing ย้อนหลังจาก Transaction Log ล่าสุดของผลิตภัณฑ์/ล็อตนี้
    IF (v_movement_id IS NULL) THEN
        -- ค้นหารายการ Void ล่าสุดที่มีการประมวลผลในช่วงเวลาปัจจุบัน (ไม่เกิน 3 วินาทีย้อนหลัง)
        SELECT smi.movement_id, 'VOID'::stock_audit_action, sm.created_by
        INTO v_movement_id, v_action_type, v_performed_by
        FROM stock_movement_items smi
        JOIN stock_movements sm ON smi.movement_id = sm.id
        WHERE smi.product_id = v_product_id 
          AND smi.lot_id = v_lot_id
          AND smi.deleted_at >= (now() - interval '3 seconds')
        ORDER BY smi.deleted_at DESC
        LIMIT 1;

        -- หากไม่ใช่การ Void ให้ค้นหาการรับเข้า/จ่ายออก ล่าสุดที่เพิ่งอินเสิร์ตในทรานแซกชันนี้
        IF (v_movement_id IS NULL) THEN
            SELECT smi.movement_id, 
                   (CASE WHEN sm.movement_type = 'RECEIVE' THEN 'RECEIVE'::stock_audit_action 
                         WHEN sm.movement_type = 'ISSUE' THEN 'ISSUE'::stock_audit_action
                         ELSE 'ADJUST'::stock_audit_action 
                    END),
                   COALESCE(auth.uid(), sm.created_by)
            INTO v_movement_id, v_action_type, v_performed_by
            FROM stock_movement_items smi
            JOIN stock_movements sm ON smi.movement_id = sm.id
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


-- -------------------------------------------------------------------------
-- 2. ดำเนินการคำนวณยอดคงเหลือใหม่ (Recalculate stock_balances) จากประวัติการเดินคลัง
-- -------------------------------------------------------------------------

-- 2.1 ปิด Trigger ชั่วคราวเพื่อป้องกันการเขียน Audit Logs จำนวนมากโดยไม่จำเป็นขณะปรับปรุงข้อมูลระบบ
ALTER TABLE public.stock_balances DISABLE TRIGGER trg_stock_balances_audit;

-- 2.2 เคลียร์ข้อมูลสต๊อกคงเหลือเดิมทั้งหมด
TRUNCATE TABLE public.stock_balances;

-- 2.3 คำนวณหายอดรวมจากประวัติการรับ (RECEIVE) และการจ่าย (ISSUE) ที่ไม่ถูกยกเลิก (Voided = false)
INSERT INTO public.stock_balances (
    product_id,
    warehouse_id,
    lot_id,
    lot_number,
    expiry_date,
    unit_price,
    current_qty
)
SELECT 
    m.product_id,
    m.warehouse_id,
    m.lot_id,
    l.lot_number,
    l.expiry_date,
    l.unit_price,
    m.current_qty
FROM (
    SELECT 
        product_id,
        warehouse_id,
        lot_id,
        SUM(net_qty) as current_qty
    FROM (
        -- 1. ยอดบวกจากการรับเข้าคลัง (RECEIVE)
        SELECT 
            smi.product_id,
            sm.to_warehouse_id AS warehouse_id,
            smi.lot_id,
            smi.qty AS net_qty
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE sm.movement_type = 'RECEIVE' 
          AND COALESCE(sm.is_voided, false) = false
        
        UNION ALL
        
        -- 2. ยอดหักจากการจ่ายออกจากคลัง (ISSUE)
        SELECT 
            smi.product_id,
            sm.from_warehouse_id AS warehouse_id,
            smi.lot_id,
            -smi.qty AS net_qty
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE sm.movement_type = 'ISSUE' 
          AND COALESCE(sm.is_voided, false) = false
    ) AS movements
    GROUP BY product_id, warehouse_id, lot_id
) AS m
JOIN public.lots l ON m.lot_id = l.id
-- หมายเหตุ: คัดกรองเฉพาะยอดคงเหลือมากกว่า 0 เข้ามาเพื่อความกระชับ (หรือหากยอมรับการติดลบ ให้เอาเงื่อนไขนี้ออก)
WHERE m.current_qty > 0;

-- 2.4 เปิดใช้งาน Trigger คืนตามปกติ
ALTER TABLE public.stock_balances ENABLE TRIGGER trg_stock_balances_audit;

COMMIT;
