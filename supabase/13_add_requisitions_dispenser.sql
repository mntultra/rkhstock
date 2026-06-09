-- =========================================================================
-- Schema Update: Add Dispensing Approver to Requisitions
-- วัตถุประสงค์: เพิ่มผู้จ่าย / ผู้อนุมัติจ่ายเวชภัณฑ์จากคลังใหญ่ (Dispensing Approver) 
-- ในตารางใบเบิก เพื่อรองรับการพิมพ์และการจัดเก็บลายเซ็นที่สมบูรณ์
-- =========================================================================

-- 1. เพิ่มคอลัมน์ dispenser_id และ dispenser_position ในตาราง requisitions
ALTER TABLE public.requisitions 
ADD COLUMN IF NOT EXISTS dispenser_id UUID REFERENCES public.staffs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS dispenser_position VARCHAR(255);

-- 2. สร้าง FK Constraint เพื่อความสมบูรณ์และถูกต้องของฐานข้อมูล
-- (ถ้ายังไม่มีและต้องการผูกกับตาราง staffs)
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_dispenser_id_fkey;
ALTER TABLE public.requisitions 
ADD CONSTRAINT requisitions_dispenser_id_fkey 
FOREIGN KEY (dispenser_id) REFERENCES public.staffs(id) ON DELETE SET NULL;
