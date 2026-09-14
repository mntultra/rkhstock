-- 45: Add destroyed_qty column to manual_expirations
-- วัตถุประสงค์: เพิ่มคอลัมน์ destroyed_qty เพื่อเก็บจำนวนที่ทำลายจริง
-- แทนการ parse จาก remark ซึ่งอาจไม่น่าเชื่อถือ

ALTER TABLE public.manual_expirations 
  ADD COLUMN IF NOT EXISTS destroyed_qty INTEGER DEFAULT 0;

-- Backfill: พยายาม extract จำนวนจาก remark ที่มีอยู่แล้ว สำหรับรายการที่ status = 'DESTROYED'
-- Format ของ remark: "ทำลายแล้ว (10 ชิ้น): EXPIRED"
UPDATE public.manual_expirations
SET destroyed_qty = COALESCE(
  (regexp_match(remark, '\((\d+)\s'))[1]::integer,
  0
)
WHERE status = 'DESTROYED' AND destroyed_qty = 0 AND remark IS NOT NULL;

-- ลบรายการ manual_expirations ที่ qty = 0 ทั้งหมด
DELETE FROM public.manual_expirations
WHERE qty = 0;
