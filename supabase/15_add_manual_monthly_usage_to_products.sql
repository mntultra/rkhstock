-- Migration: Add manual_monthly_usage to products table
-- Description: Adds a custom average monthly usage column to the products table to allow manual override values for MOS/Requisition rate estimates.

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS manual_monthly_usage NUMERIC(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN public.products.manual_monthly_usage IS 'อัตราการใช้เวชภัณฑ์เฉลี่ยต่อเดือนที่ระบุเอง (Manual Monthly Usage Rate)';
