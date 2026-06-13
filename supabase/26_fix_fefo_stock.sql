-- =========================================================================
-- Migration 26: Fix Historical Lot Tracking Discrepancies using FEFO
-- และคำนวณยอดคงเหลือใหม่ (Recalculate stock_balances) 
--
-- ปัญหา:
-- ข้อมูลประวัติการจ่ายออก (DISPENSE) ในอดีตถูกบันทึกโดยหักยอดออกจากล็อตเดียวกันหมด
-- ทำให้ล็อตนั้นมียอดติดลบสะสม (เช่น -530) ขณะที่ล็อตอื่นๆ มีค่ายอดบวกค้างอยู่
-- เมื่อระบบจัดเก็บเฉพาะยอดที่เป็นบวก (>0) จึงทำให้ข้อมูลสต๊อกในหน้าจอตัดจ่ายสูงกว่าความเป็นจริง
-- และไม่ตรงกับหน้ารายงานบัญชีคุม (Stock Card)
--
-- วิธีแก้:
-- 1. ใช้ระบบ FEFO (First Expired, First Out) ในการจับคู่ประวัติจ่ายออกในอดีตกับล็อตที่รับเข้าจริง
-- 2. อัปเดต lot_id ของรายการจ่ายออกในตาราง stock_movement_items และแบ่งรายการหากปริมาณครอบคลุมหลายล็อต
-- 3. คำนวณยอดคงเหลือในตาราง stock_balances ใหม่ทั้งหมด
-- =========================================================================

BEGIN;

DO $$
DECLARE
    r_disp RECORD;
    r_rec RECORD;
    v_needed INTEGER;
    v_take INTEGER;
    v_first BOOLEAN;
    v_new_item_id UUID;
    v_last_item_id UUID;
    v_original_item RECORD;
BEGIN
    -- 1. ปิดการทำงานของ Trigger ชั่วคราวเพื่อป้องกันการบันทึก Audit Logs และการประมวลผลซ้ำซ้อน
    ALTER TABLE public.stock_balances DISABLE TRIGGER trg_stock_balances_audit;

    -- 2. สร้างตารางชั่วคราวเก็บข้อมูลรับเข้าคลัง (RECEIVE) เพื่อใช้ทำ FEFO Pool
    CREATE TEMP TABLE temp_receives (
        id UUID,
        product_id UUID,
        warehouse_id UUID,
        lot_id UUID,
        available_qty INTEGER,
        expiry_date DATE,
        doc_date DATE
    ) ON COMMIT DROP;
    
    -- 3. สร้างตารางชั่วคราวเก็บข้อมูลจ่ายออกคลัง (DISPENSE) เพื่อใช้ไล่หักยอดตามเวลา
    CREATE TEMP TABLE temp_dispenses (
        id UUID,
        movement_id UUID,
        product_id UUID,
        warehouse_id UUID,
        qty INTEGER,
        doc_date DATE
    ) ON COMMIT DROP;

    -- 4. ดึงข้อมูลประวัติการรับเข้าทั้งหมด
    INSERT INTO temp_receives (id, product_id, warehouse_id, lot_id, available_qty, expiry_date, doc_date)
    SELECT 
        smi.id,
        smi.product_id,
        sm.to_warehouse_id,
        smi.lot_id,
        smi.qty,
        COALESCE(l.expiry_date, '9999-12-31'::DATE),
        sm.doc_date
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    JOIN public.lots l ON smi.lot_id = l.id
    WHERE sm.movement_type = 'RECEIVE' 
      AND COALESCE(sm.is_voided, false) = false;

    -- 5. ดึงข้อมูลประวัติการจ่ายออกทั้งหมด เรียงตามวันที่ทำรายการ
    INSERT INTO temp_dispenses (id, movement_id, product_id, warehouse_id, qty, doc_date)
    SELECT 
        smi.id,
        smi.movement_id,
        smi.product_id,
        sm.from_warehouse_id,
        smi.qty,
        sm.doc_date
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE sm.movement_type = 'DISPENSE' 
      AND COALESCE(sm.is_voided, false) = false;

    -- 6. วนลูปประมวลผลจ่ายออกทีละรายการเพื่อจัดสรรล็อตตามหลัก FEFO
    FOR r_disp IN 
        SELECT * FROM temp_dispenses ORDER BY doc_date ASC, id ASC
    LOOP
        v_needed := r_disp.qty;
        v_first := true;
        v_last_item_id := NULL;
        
        -- ค้นหาล็อตที่หมดอายุก่อนของสินค้านั้นๆ ในคลังเดียวกัน
        FOR r_rec IN 
            SELECT * FROM temp_receives 
            WHERE product_id = r_disp.product_id 
              AND warehouse_id = r_disp.warehouse_id
              AND available_qty > 0
            ORDER BY expiry_date ASC, doc_date ASC
        LOOP
            IF v_needed <= 0 THEN
                EXIT;
            END IF;
            
            v_take := LEAST(r_rec.available_qty, v_needed);
            
            -- หักยอดออกจากพูลรับเข้า
            UPDATE temp_receives 
            SET available_qty = available_qty - v_take
            WHERE id = r_rec.id;
            
            v_needed := v_needed - v_take;
            
            IF v_first THEN
                -- รายการแรก: อัปเดตข้อมูลของแถวเดิมในตารางจริง
                UPDATE public.stock_movement_items
                SET lot_id = r_rec.lot_id,
                    qty = v_take
                WHERE id = r_disp.id;
                
                v_last_item_id := r_disp.id;
                v_first := false;
            ELSE
                -- รายการถัดไป: คัดลอกรายละเอียดแถวเดิมแล้วทำรายการ insert แยกเป็นอีกบรรทัด (Split Row)
                SELECT * INTO v_original_item FROM public.stock_movement_items WHERE id = r_disp.id;
                
                v_new_item_id := gen_random_uuid();
                INSERT INTO public.stock_movement_items (
                    id, movement_id, product_id, qty, unit_id, 
                    created_at, updated_at, deleted_at, created_by, updated_by, 
                    pack_size, unit_name, unit_price, remark, lot_id
                ) VALUES (
                    v_new_item_id, v_original_item.movement_id, v_original_item.product_id, v_take, v_original_item.unit_id,
                    v_original_item.created_at, v_original_item.updated_at, v_original_item.deleted_at, v_original_item.created_by, v_original_item.updated_by,
                    v_original_item.pack_size, v_original_item.unit_name, v_original_item.unit_price, v_original_item.remark, r_rec.lot_id
                );
                
                v_last_item_id := v_new_item_id;
            END IF;
        END LOOP;
        
        -- กรณีเกิดยอดขาดสต๊อก (Shortage) ให้บวกยอดคงเหลือที่หาแหล่งไม่ได้ กลับไปยังรายการล่าสุดที่อัปเดต เพื่อให้ยอดรวมเอกสารไม่เปลี่ยน
        IF v_needed > 0 AND v_last_item_id IS NOT NULL THEN
            UPDATE public.stock_movement_items
            SET qty = qty + v_needed
            WHERE id = v_last_item_id;
        END IF;
    END LOOP;
END $$;

-- 7. เคลียร์ตารางยอดคงเหลือเดิม (stock_balances)
TRUNCATE TABLE public.stock_balances;

-- 8. คำนวณหายอดคงคลังใหม่จากประวัติการรับเข้า-จ่ายออกที่ผ่านการปรับแก้ล็อตแล้ว
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
        -- 8.1 ยอดบวกจากการรับเข้าคลัง (RECEIVE)
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
        
        -- 8.2 ยอดหักจากการจ่ายออกจากคลัง (DISPENSE)
        SELECT 
            smi.product_id,
            sm.from_warehouse_id AS warehouse_id,
            smi.lot_id,
            -smi.qty AS net_qty
        FROM public.stock_movement_items smi
        JOIN public.stock_movements sm ON smi.movement_id = sm.id
        WHERE sm.movement_type = 'DISPENSE' 
          AND COALESCE(sm.is_voided, false) = false
    ) AS movements
    GROUP BY product_id, warehouse_id, lot_id
) AS m
JOIN public.lots l ON m.lot_id = l.id
WHERE m.current_qty > 0;

-- 9. เปิดใช้งาน Trigger สำหรับ stock_balances กลับคืนเดิม
ALTER TABLE public.stock_balances ENABLE TRIGGER trg_stock_balances_audit;

COMMIT;
