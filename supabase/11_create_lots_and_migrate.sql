BEGIN;

-- ==========================================
-- 1. สร้างตาราง lots
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_number VARCHAR(100) NOT NULL DEFAULT '-',
    expiry_date DATE,
    unit_price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- ป้องกันการสร้าง Lot ซ้ำ (รองรับกรณี expiry_date เป็น NULL)
CREATE UNIQUE INDEX IF NOT EXISTS lots_unique_idx 
ON public.lots (product_id, lot_number, COALESCE(expiry_date, '9999-12-31'::DATE));

-- เปิดใช้งาน RLS
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- สร้าง Policies เบื้องต้น
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lots;
CREATE POLICY "Enable read access for all users" ON public.lots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.lots;
CREATE POLICY "Enable insert for authenticated users only" ON public.lots FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.lots;
CREATE POLICY "Enable update for authenticated users only" ON public.lots FOR UPDATE USING (auth.role() = 'authenticated');


-- ==========================================
-- 2. เพิ่มคอลัมน์ lot_id (หากยังไม่มี)
-- ==========================================
ALTER TABLE public.stock_balances 
ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.lots(id);

ALTER TABLE public.stock_movement_items 
ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.lots(id);


-- ==========================================
-- 3. นำเข้าข้อมูล (Migrate) ข้อมูลจากประวัติเก่า
-- ==========================================
INSERT INTO public.lots (product_id, lot_number, expiry_date, unit_price)
SELECT 
    product_id, 
    COALESCE(lot_number, '-'), 
    expiry_date, 
    MAX(COALESCE(unit_price, 0)) as unit_price
FROM (
    SELECT product_id, lot_number, expiry_date, unit_price FROM public.stock_balances
    UNION
    SELECT product_id, lot_number, expiry_date, unit_price FROM public.stock_movement_items
) AS all_lots
WHERE product_id IS NOT NULL
GROUP BY product_id, COALESCE(lot_number, '-'), expiry_date
ON CONFLICT (product_id, lot_number, COALESCE(expiry_date, '9999-12-31'::DATE)) 
DO UPDATE SET unit_price = EXCLUDED.unit_price;


-- ==========================================
-- 4. จับคู่ lot_id กลับคืนให้ข้อมูลเดิม (Backfill)
-- ==========================================

-- อัปเดตตาราง stock_balances
UPDATE public.stock_balances sb
SET lot_id = l.id
FROM public.lots l
WHERE sb.product_id = l.product_id 
  AND COALESCE(sb.lot_number, '-') = l.lot_number 
  AND (sb.expiry_date = l.expiry_date OR (sb.expiry_date IS NULL AND l.expiry_date IS NULL))
  AND sb.lot_id IS NULL;

-- อัปเดตตาราง stock_movement_items
UPDATE public.stock_movement_items smi
SET lot_id = l.id
FROM public.lots l
WHERE smi.product_id = l.product_id 
  AND COALESCE(smi.lot_number, '-') = l.lot_number 
  AND (smi.expiry_date = l.expiry_date OR (smi.expiry_date IS NULL AND l.expiry_date IS NULL))
  AND smi.lot_id IS NULL;

COMMIT;
