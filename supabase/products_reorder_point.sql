-- เพิ่มคอลัมน์ reorder_point ในตาราง products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS reorder_point integer DEFAULT 0;

-- เพิ่ม comment ให้ column
COMMENT ON COLUMN public.products.reorder_point IS 'จุดสั่งซื้อ (ถ้าสต๊อกรวมต่ำกว่าหรือเท่ากับค่านี้ จะแจ้งเตือน Low Stock)';
