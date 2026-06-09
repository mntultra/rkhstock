-- Migration: Add usage_rate to requisition_items table
-- Description: Adds a column to store the historical or manual average usage rate of the product at the time of requisition.

ALTER TABLE public.requisition_items 
ADD COLUMN IF NOT EXISTS usage_rate NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.requisition_items.usage_rate IS 'อัตราการใช้เฉลี่ยหรือ manual usage rate ณ ขณะที่ทำการเบิก';
