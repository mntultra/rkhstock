-- ============================================================
-- Migration 40: สร้างตาราง product_barcodes (One-to-Many)
-- เวชภัณฑ์ 1 รายการ สามารถมีได้หลายบาร์โค้ด / หลายยี่ห้อ
-- ============================================================

CREATE TABLE IF NOT EXISTS product_barcodes (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode      text NOT NULL,
  brand_name   text,
  barcode_type text NOT NULL DEFAULT 'EAN13',   -- EAN13 | Code128 | QR | GS1-128 | DataMatrix
  is_primary   boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_barcodes_barcode_unique UNIQUE (barcode)
);

COMMENT ON TABLE  product_barcodes                  IS 'บาร์โค้ด/QR Code ที่ผูกกับเวชภัณฑ์แบบ One-to-Many';
COMMENT ON COLUMN product_barcodes.barcode          IS 'ค่าบาร์โค้ด (EAN, Code128, QR string, GS1 GTIN ฯลฯ)';
COMMENT ON COLUMN product_barcodes.brand_name       IS 'ยี่ห้อ/ชื่อการค้า (null = QR ที่ผลิตเอง)';
COMMENT ON COLUMN product_barcodes.barcode_type     IS 'ประเภทสัญลักษณ์: EAN13, Code128, QR, GS1-128, DataMatrix';
COMMENT ON COLUMN product_barcodes.is_primary       IS 'บาร์โค้ดหลักของสินค้า (แสดงใน PrintLabel)';

-- Index
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode    ON product_barcodes(barcode);

-- RLS
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_barcodes_all_authenticated"
  ON product_barcodes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
