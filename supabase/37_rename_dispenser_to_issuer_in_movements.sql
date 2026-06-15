-- =========================================================================
-- Migration 37: Rename dispenser columns to issuer in stock_movements
-- วัตถุประสงค์: 
--   เปลี่ยนชื่อคอลัมน์จากคำว่า dispenser เป็น issuer เพื่อให้ตรงกับคอนเซปต์ใหม่
-- วิธีใช้: คัดลอกโค้ดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

DO $$
BEGIN
    -- เช็คและเปลี่ยนชื่อคอลัมน์ dispenser_main_warehouse -> issuer_main_warehouse
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'dispenser_main_warehouse') THEN
        ALTER TABLE public.stock_movements RENAME COLUMN dispenser_main_warehouse TO issuer_main_warehouse;
    END IF;

    -- เช็คและเปลี่ยนชื่อคอลัมน์ dispenser_sub_warehouse -> issuer_sub_warehouse
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'dispenser_sub_warehouse') THEN
        ALTER TABLE public.stock_movements RENAME COLUMN dispenser_sub_warehouse TO issuer_sub_warehouse;
    END IF;
END $$;
