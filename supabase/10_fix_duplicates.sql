BEGIN;

-- 1. ปลดล็อกระบบป้องกันการลบและแก้ไข
DROP RULE IF EXISTS protect_audit_logs_delete ON public.stock_audit_logs;
DROP RULE IF EXISTS protect_audit_logs_update ON public.stock_audit_logs;

-- 2. ค้นหาและลบเอกสารซ้ำซ้อน (เก็บตัวที่เก่าที่สุดไว้)
WITH duplicate_movements AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY doc_no ORDER BY created_at ASC) as rn
    FROM public.stock_movements
    WHERE doc_no IN ('REC20251022-01', 'DIS20250825-02', 'DIS20251004-01', 'DIS20251215-01')
)
DELETE FROM public.stock_movement_items WHERE movement_id IN (SELECT id FROM duplicate_movements WHERE rn > 1);

WITH duplicate_movements AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY doc_no ORDER BY created_at ASC) as rn
    FROM public.stock_movements
    WHERE doc_no IN ('REC20251022-01', 'DIS20250825-02', 'DIS20251004-01', 'DIS20251215-01')
)
DELETE FROM public.stock_movements WHERE id IN (SELECT id FROM duplicate_movements WHERE rn > 1);

-- 3. ล้างยอดสต๊อกคงเหลือทั้งหมดเพื่อเตรียมคำนวณใหม่
TRUNCATE TABLE public.stock_balances CASCADE;

-- 4. คำนวณยอดสต๊อกใหม่จากประวัติที่ถูกต้อง
WITH movement_deltas AS (
    -- ขาเข้า (RECEIVE, RETURN)
    SELECT 
        smi.product_id,
        sm.to_warehouse_id AS warehouse_id,
        smi.lot_number,
        smi.expiry_date,
        smi.unit_price,
        smi.qty AS delta_qty
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE COALESCE(sm.is_voided, false) = false 
      AND sm.movement_type::text IN ('RECEIVE', 'RETURN')
      
    UNION ALL
    
    -- ขาออก (DISPENSE, EXPIRED)
    SELECT 
        smi.product_id,
        sm.from_warehouse_id AS warehouse_id,
        smi.lot_number,
        smi.expiry_date,
        smi.unit_price,
        -(smi.qty) AS delta_qty
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE COALESCE(sm.is_voided, false) = false 
      AND sm.movement_type::text IN ('DISPENSE', 'EXPIRED')
      
    UNION ALL
    
    -- ขาโอน (TRANSFER)
    SELECT 
        smi.product_id,
        sm.to_warehouse_id AS warehouse_id,
        smi.lot_number,
        smi.expiry_date,
        smi.unit_price,
        smi.qty AS delta_qty
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE COALESCE(sm.is_voided, false) = false 
      AND sm.movement_type::text = 'TRANSFER'
      
    UNION ALL
    
    SELECT 
        smi.product_id,
        sm.from_warehouse_id AS warehouse_id,
        smi.lot_number,
        smi.expiry_date,
        smi.unit_price,
        -(smi.qty) AS delta_qty
    FROM public.stock_movement_items smi
    JOIN public.stock_movements sm ON smi.movement_id = sm.id
    WHERE COALESCE(sm.is_voided, false) = false 
      AND sm.movement_type::text = 'TRANSFER'
)
INSERT INTO public.stock_balances (
    product_id, warehouse_id, lot_number, expiry_date, unit_price, current_qty
)
SELECT 
    product_id,
    warehouse_id,
    lot_number,
    expiry_date,
    MAX(unit_price) AS unit_price,
    SUM(delta_qty) AS current_qty
FROM movement_deltas
GROUP BY product_id, warehouse_id, lot_number, expiry_date
HAVING SUM(delta_qty) > 0;

-- 5. กู้คืนระบบป้องกัน
CREATE RULE protect_audit_logs_update AS ON UPDATE TO public.stock_audit_logs DO INSTEAD NOTHING;
CREATE RULE protect_audit_logs_delete AS ON DELETE TO public.stock_audit_logs DO INSTEAD NOTHING;

COMMIT;
