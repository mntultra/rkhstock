-- =========================================================================
-- Schema Update: Automatic Sequential Document Numbering System
-- วัตถุประสงค์: สร้างระบบรันเลขที่เอกสารอัตโนมัติ (doc_no) แบบเรียงลำดับไม่ซ้ำกันในแต่ละวัน
-- Format: [PREFIX][YYYYMMDD]-[ลำดับ 2 หลัก] (เช่น REQ20261230-01, REC20261230-01, DIS20261230-01)
-- =========================================================================

-- 1. เพิ่มคอลัมน์ doc_no ในตาราง stock_movements (ถ้ายังไม่มี)
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS doc_no VARCHAR(50);

COMMENT ON COLUMN public.stock_movements.doc_no IS 'เลขที่เอกสารคลัง (เช่น REC20261230-01 หรือ DIS20261230-01)';

-- 2. สร้างฟังก์ชันส่วนกลางสำหรับการเจนเลขที่เอกสารแบบปลอดภัย (Thread-Safe)
CREATE OR REPLACE FUNCTION public.generate_document_no()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    date_str TEXT;
    next_seq INTEGER;
    formatted_seq TEXT;
    target_date DATE;
BEGIN
    -- ใช้ doc_date เป็นหลักในการสร้างเลขเอกสารตามวันของเอกสาร
    target_date := COALESCE(NEW.doc_date, CURRENT_DATE);
    date_str := to_char(target_date, 'YYYYMMDD');

    -- กำหนดคำขึ้นต้นเอกสาร (Prefix)
    IF TG_TABLE_NAME = 'requisitions' THEN
        prefix := 'REQ';
    ELSIF TG_TABLE_NAME = 'stock_movements' THEN
        IF NEW.movement_type = 'RECEIVE' THEN
            prefix := 'REC';
        ELSIF NEW.movement_type = 'ISSUE' THEN
            prefix := 'DIS';
        ELSE
            -- สำหรับความเคลื่อนไหวอื่น ๆ เช่น ADJUST หรือ RETURN
            prefix := NEW.movement_type;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- หากมีเลขที่เอกสารส่งเข้ามาแล้วและไม่ใช่รูปแบบเก่า/ค่าว่าง ให้ใช้ค่าเดิมได้ (Manual Override)
    IF NEW.doc_no IS NOT NULL AND NEW.doc_no <> '' AND NEW.doc_no NOT LIKE 'RQ-%' THEN
        RETURN NEW;
    END IF;

    -- ค้นหาลำดับถัดไป (รันต่อกันเฉพาะในแต่ละวันของชนิดเอกสารนั้น ๆ)
    IF TG_TABLE_NAME = 'requisitions' THEN
        SELECT COALESCE(MAX(SUBSTRING(doc_no FROM '\d{8}-(\d{2})$')::INTEGER), 0) + 1
        INTO next_seq
        FROM public.requisitions
        WHERE doc_date = target_date
          AND doc_no LIKE prefix || date_str || '-%';
    ELSIF TG_TABLE_NAME = 'stock_movements' THEN
        SELECT COALESCE(MAX(SUBSTRING(doc_no FROM '\d{8}-(\d{2})$')::INTEGER), 0) + 1
        INTO next_seq
        FROM public.stock_movements
        WHERE doc_date = target_date
          AND movement_type = NEW.movement_type
          AND doc_no LIKE prefix || date_str || '-%';
    END IF;

    -- ฟอร์แมตเลขลำดับให้เป็น 2 หลัก (เช่น 01, 02)
    formatted_seq := LPAD(next_seq::TEXT, 2, '0');

    -- ประกอบตัวเลขเป็นเลขที่เอกสารใหม่
    NEW.doc_no := prefix || date_str || '-' || formatted_seq;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ติดตั้ง Trigger สำหรับตารางใบเบิก (requisitions)
DROP TRIGGER IF EXISTS trg_generate_requisitions_doc_no ON public.requisitions;
CREATE TRIGGER trg_generate_requisitions_doc_no
BEFORE INSERT ON public.requisitions
FOR EACH ROW
EXECUTE FUNCTION public.generate_document_no();

-- 4. ติดตั้ง Trigger สำหรับตารางความเคลื่อนไหวคลัง (stock_movements)
DROP TRIGGER IF EXISTS trg_generate_stock_movements_doc_no ON public.stock_movements;
CREATE TRIGGER trg_generate_stock_movements_doc_no
BEFORE INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.generate_document_no();
