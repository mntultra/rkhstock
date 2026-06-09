-- Add remark field to stock_movement_items table
ALTER TABLE stock_movement_items ADD COLUMN IF NOT EXISTS remark TEXT;

-- Update the comment for the table to reflect this new column
COMMENT ON COLUMN stock_movement_items.remark IS 'หมายเหตุรายรายการสำหรับการรับเข้าหรือเบิกจ่าย';
