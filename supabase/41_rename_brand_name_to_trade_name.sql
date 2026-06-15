-- Migration: Rename brand_name to trade_name in product_barcodes table
ALTER TABLE product_barcodes RENAME COLUMN brand_name TO trade_name;

COMMENT ON COLUMN product_barcodes.trade_name IS 'ยี่ห้อ/ชื่อการค้า (null = QR ที่ผลิตเอง)';
