-- =========================================================================
-- 1. เพิ่มคอลัมน์ในตาราง requisition_items (สำหรับบันทึกยอดรับจริงและหมายเหตุ)
-- =========================================================================
ALTER TABLE public.requisition_items 
ADD COLUMN IF NOT EXISTS received_qty NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS receive_remark TEXT;

-- =========================================================================
-- 2. เพิ่มคอลัมน์ในตาราง stock_movements (สำหรับข้อมูลส่วนหัวใบรับและใบจ่าย)
-- =========================================================================
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS doc_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS reference_doc_no VARCHAR(255),
ADD COLUMN IF NOT EXISTS reference_doc_date DATE,
ADD COLUMN IF NOT EXISTS source_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS destination_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.staffs(id),
ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES public.requisitions(id);

-- เพิ่ม Comment เพื่ออธิบายโครงสร้าง (ตัวเลือกเสริม)
COMMENT ON COLUMN public.stock_movements.doc_date IS 'วันที่รับ หรือ วันที่จ่าย';
COMMENT ON COLUMN public.stock_movements.reference_doc_no IS 'เลขที่เอกสารอ้างอิง เช่น เลขที่ใบส่งของ';
COMMENT ON COLUMN public.stock_movements.reference_doc_date IS 'ลงวันที่เอกสารอ้างอิง';
COMMENT ON COLUMN public.stock_movements.source_location IS 'สถานที่ต้นทาง เช่น คลังยาใหญ่รพ.';
COMMENT ON COLUMN public.stock_movements.destination_location IS 'สถานที่ปลายทาง เช่น ชั้นจุดจ่ายยาฉีด';
COMMENT ON COLUMN public.stock_movements.actor_id IS 'ผู้ทำรายการ (ผู้รับเวชภัณฑ์ หรือ ผู้หยิบจ่าย) อ้างอิงจาก staffs';
COMMENT ON COLUMN public.stock_movements.requisition_id IS 'อ้างอิงไปยังใบเบิกในกรณีที่เป็นการรับจากการเบิก';
