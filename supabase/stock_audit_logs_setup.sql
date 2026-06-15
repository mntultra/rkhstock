-- =========================================================================
-- RKHSTOCK - IMMUTABLE STOCK AUDIT LOG SYSTEM (MEDICO-LEGAL GRADE)
-- วัตถุประสงค์: ติดตามทุกความเคลื่อนไหวการเปลี่ยนแปลงสต๊อกยา (รับ/จ่าย/Void/ปรับยอด)
-- เพื่อให้ตรวจสอบที่มาของยาหายหรือข้อผิดพลาดได้ 100% แบบแก้ไข/ลบไม่ได้ (Immutable)
-- วิธีใช้: คัดลอกโค้ดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

-- 1. สร้าง Enum สำหรับประเภทการดำเนินงานคลัง
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_audit_action') THEN
        CREATE TYPE stock_audit_action AS ENUM ('RECEIVE', 'ISSUE', 'VOID', 'ADJUST', 'CORRECTION');
    END IF;
END
$$;

-- 2. สร้างตาราง Stock Audit Logs
CREATE TABLE IF NOT EXISTS stock_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type stock_audit_action NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    lot_number VARCHAR(100) NOT NULL,
    qty_before INTEGER NOT NULL DEFAULT 0,
    qty_change INTEGER NOT NULL,
    qty_after INTEGER NOT NULL,
    movement_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. สร้าง Indexes เพื่อเพิ่มประสิทธิภาพการค้นหาในการตรวจสอบ (Auditing)
CREATE INDEX IF NOT EXISTS idx_stock_audit_product ON stock_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_created_at ON stock_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_audit_lot ON stock_audit_logs(lot_number);
CREATE INDEX IF NOT EXISTS idx_stock_audit_movement ON stock_audit_logs(movement_id);

-- 4. บังคับใช้ความปลอดภัยสูงสุด: ป้องกันการแก้ไข (UPDATE) หรือการลบ (DELETE) ในตาราง Audit Logs
-- เพื่อทำให้ตารางนี้กลายเป็น IMMUTABLE LEDGER (แก้/ลบประวัติไม่ได้เด็ดขาด)
CREATE OR REPLACE RULE protect_audit_logs_update AS 
ON UPDATE TO stock_audit_logs 
DO INSTEAD NOTHING;

CREATE OR REPLACE RULE protect_audit_logs_delete AS 
ON DELETE TO stock_audit_logs 
DO INSTEAD NOTHING;

-- 5. สร้าง Trigger Function สำหรับประมวลผล Audit Logs จากการเปลี่ยนในตาราง stock_balances
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
    -- ดึงข้อมูล Movement ID ล่าสุดของยานี้ในธุรกรรมปัจจุบัน (Session-local variables หรือ Query ย้อนหลังในระดับวินาทีปัจจุบัน)
    -- ดึงตัวแปรชั่วคราวจาก Config Session หากมี (เช่น ตั้งค่าผ่าน RPC)
    BEGIN
        v_movement_id := NULLIF(current_setting('app.current_movement_id', true), '')::UUID;
        v_action_type := NULLIF(current_setting('app.current_movement_type', true), '')::stock_audit_action;
    EXCEPTION WHEN OTHERS THEN
        v_movement_id := NULL;
    END;

    -- หากไม่มีการระบุตัวแปรใน Session ให้ค้นหาแบบ Tracing ย้อนหลังจาก Transaction Log ล่าสุดของผลิตภัณฑ์/ล็อตนี้
    IF (v_movement_id IS NULL) THEN
        -- ค้นหารายการ Void ล่าสุดที่มีการประมวลผลในช่วงเวลาปัจจุบัน
        SELECT smi.movement_id, 'VOID'::stock_audit_action, sm.created_by
        INTO v_movement_id, v_action_type, v_performed_by
        FROM stock_movement_items smi
        JOIN stock_movements sm ON smi.movement_id = sm.id
        WHERE smi.product_id = v_product_id 
          AND smi.lot_number = v_lot_number
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
              AND smi.lot_number = v_lot_number
              AND smi.created_at >= (now() - interval '3 seconds')
              AND smi.deleted_at IS NULL
            ORDER BY smi.created_at DESC
            LIMIT 1;
        END IF;
    END IF;

    -- 5.3 หากสืบหาประวัติทำรายการไม่พบ ให้จัดประเภทตามปริมาณความเคลื่อนไหว (Direct Adjustments)
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

    -- 6. ทำการบันทึกประวัติการตรวจสอบอย่างเป็นทางการลงใน Immutable Audit Log Table
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

-- 7. ติดตั้ง Trigger ไปที่ตาราง stock_balances
DROP TRIGGER IF EXISTS trg_stock_balances_audit ON stock_balances;
CREATE TRIGGER trg_stock_balances_audit
AFTER INSERT OR UPDATE OR DELETE ON stock_balances
FOR EACH ROW
EXECUTE FUNCTION process_stock_balance_audit();

-- 8. เปิดใช้งาน RLS สำหรับตาราง Audit Logs (อ่านได้อย่างเดียวตามความจำเป็น ห้ามแก้ไข/ลบ)
ALTER TABLE stock_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read audit logs for authenticated users" 
ON stock_audit_logs 
FOR SELECT 
TO authenticated 
USING (true);

-- =========================================================================
-- [คำแนะนำการใช้สำหรับผู้ดูแลระบบ]
-- หลังจากรันสคริปต์นี้แล้ว ทุกครั้งที่มีการบันทึก รับยา, ตัดจ่ายยา, ยกเลิกใบเบิก (Void),
-- หรือแก้จำนวนยาตรงๆ ในระบบ ระบบ Postgres จะทำการแอบสร้าง Immutable Audit Log 
-- ป้องกันการตกหล่นของข้อมูลทางกฎหมายแพทย์ (Medicolegal) ได้อย่างสมบูรณ์แบบ
-- =========================================================================
