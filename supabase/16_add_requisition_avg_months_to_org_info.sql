-- Migration: Add requisition_avg_months to organization_info table
-- Description: Adds a column to specify the default number of months (e.g. 3, 6, 9, 12) used to calculate average monthly usage and auto-requisition rates.

ALTER TABLE public.organization_info 
ADD COLUMN IF NOT EXISTS requisition_avg_months INTEGER DEFAULT 6;

COMMENT ON COLUMN public.organization_info.requisition_avg_months IS 'จำนวนเดือนที่ใช้เป็นค่าเริ่มต้นในการคำนวณอัตราการใช้เฉลี่ยย้อนหลังสำหรับ Auto Rate (3, 6, 9, 12)';
