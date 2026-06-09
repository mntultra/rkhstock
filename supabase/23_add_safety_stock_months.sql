-- Migration: Add safety_stock_months to organization_info table
-- Description: Adds a column to specify the safety stock target period in months (e.g. 1, 2, 3) for calculating suggested requisition quantities.

ALTER TABLE public.organization_info 
ADD COLUMN IF NOT EXISTS safety_stock_months INTEGER DEFAULT 1;

COMMENT ON COLUMN public.organization_info.safety_stock_months IS 'จำนวนเดือนที่ต้องการสำรองคลัง (Safety Stock) สำหรับคำนวณปริมาณเสนอแนะในการเบิก (1, 2, 3)';
