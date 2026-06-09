-- 1. เพิ่มฟิลด์ในตาราง products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_psycho_narco BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_high_alert BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cold_storage BOOLEAN DEFAULT false;

-- 2. เพิ่ม unit_price ลงใน stock_balances และ stock_movement_items เพื่อบันทึกต้นทุน ณ วันที่ทำรายการ/ล็อตนั้นๆ
ALTER TABLE public.stock_balances 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00;

ALTER TABLE public.stock_movement_items 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00;

-- 3. อัปเดตข้อมูลราคาปัจจุบันให้กับสต๊อกเดิม (อิงจากราคาปัจจุบันใน products ถ้าตั้งไว้, ถ้าไม่มีจะเป็น 0)
UPDATE public.stock_balances sb
SET unit_price = COALESCE((SELECT unit_price FROM public.products p WHERE p.id = sb.product_id), 0.00)
WHERE sb.unit_price = 0.00 OR sb.unit_price IS NULL;

UPDATE public.stock_movement_items smi
SET unit_price = COALESCE((SELECT unit_price FROM public.products p WHERE p.id = smi.product_id), 0.00)
WHERE smi.unit_price = 0.00 OR smi.unit_price IS NULL;
