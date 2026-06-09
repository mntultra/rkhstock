-- =========================================================================
-- RKHSTOCK - DATABASE CLEANUP SYSTEM (ล้างประวัติการรับเข้าและธุรกรรมสต๊อกทั้งหมด)
-- วัตถุประสงค์: เพื่อความปลอดภัยสูงสุดและรักษาความสมบูรณ์ของฐานข้อมูล (Database Integrity)
-- เนื่องจากระบบนี้มีระบบตรวจทานประวัติ (Immutable Audit Ledger) และการคำนวณยอดคงคลังแบบ FEFO/FIFO 
-- การลบข้อมูลเพียงบางส่วน (เช่น ลบเฉพาะการรับเข้า แต่เก็บการจ่ายออก/ตัดจำหน่ายไว้) 
-- จะทำให้เกิดปัญหาสต๊อกติดลบหรือข้อมูลประวัติไม่สัมพันธ์กัน
--
-- วิธีใช้: คัดเลือกแนวทางด้านล่างนี้ (แนะนำแนวทางที่ 1) แล้วนำไปรันใน Supabase SQL Editor
-- =========================================================================

-- =========================================================================
-- [แนวทางที่ 1] ล้างข้อมูลธุรกรรมและการเคลื่อนไหวสต๊อกทั้งหมด (แนะนำสำหรับเริ่มใช้งานจริง)
-- *เก็บรายชื่อเวชภัณฑ์ (Products), เจ้าหน้าที่ (Staffs), คลัง (Warehouses) และประชากรตั้งค่าต่างๆ ไว้ 100%*
-- *ล้างประวัติการรับเข้า จ่ายออก ปรับยอด ยืม-คืน และประวัติการเบิก เพื่อเริ่มนับสต๊อกใหม่จากศูนย์*
-- =========================================================================

BEGIN;

-- 1. ปลดล็อกระบบล็อกประวัติความปลอดภัยชั่วคราว (Drop rules that protect audit logs from delete)
DROP RULE IF EXISTS protect_audit_logs_delete ON public.stock_audit_logs;
DROP RULE IF EXISTS protect_audit_logs_update ON public.stock_audit_logs;

-- 2. ล้างข้อมูลตารางประวัติธุรกรรมคลัง
TRUNCATE TABLE public.stock_movement_items CASCADE;
TRUNCATE TABLE public.stock_movements CASCADE;
TRUNCATE TABLE public.stock_balances CASCADE;
TRUNCATE TABLE public.stock_audit_logs CASCADE;
TRUNCATE TABLE public.borrowings CASCADE;

-- 3. รีเซ็ตใบเบิก (Requisitions) ให้กลับไปเป็นแบบฟอร์มเปล่าหรือล้างทั้งหมด
-- เลือกข้อใดข้อหนึ่ง (เอาเครื่องหมาย -- ออกตามที่ต้องการ):

-- ข้อ 3.1: (แนะนำ) ลบรายการใบเบิกทั้งหมด เพื่อให้ระบบว่างเปล่า
TRUNCATE TABLE public.requisition_items CASCADE;
TRUNCATE TABLE public.requisitions CASCADE;

-- ข้อ 3.2: หากต้องการเก็บเฉพาะโครงสร้างใบเบิกไว้ แต่ล้างยอดที่เคยได้รับแล้ว
-- UPDATE public.requisition_items SET received_qty = 0, receive_remark = NULL;
-- UPDATE public.requisitions SET status = 'PENDING';

-- 4. กู้คืนระบบล็อกประวัติความปลอดภัยเพื่อตรวจสอบในอนาคต (Recreate protection rules)
CREATE RULE protect_audit_logs_update AS 
ON UPDATE TO public.stock_audit_logs 
DO INSTEAD NOTHING;

CREATE RULE protect_audit_logs_delete AS 
ON DELETE TO public.stock_audit_logs 
DO INSTEAD NOTHING;

COMMIT;

-- =========================================================================
-- [แนวทางที่ 2] ลบเฉพาะ "รายการรับเข้าเวชภัณฑ์ (RECEIVE)"
-- *คำเตือน: โปรดใช้เฉพาะกรณีที่ระบบไม่มีธุรกรรมประเภทอื่น (เช่น ยังไม่ได้ทำการจ่ายยาหรือยืมยาเลย)*
-- =========================================================================

/*
BEGIN;

-- 1. ปลดล็อกระบบล็อกประวัติความปลอดภัยชั่วคราว
DROP RULE IF EXISTS protect_audit_logs_delete ON public.stock_audit_logs;
DROP RULE IF EXISTS protect_audit_logs_update ON public.stock_audit_logs;

-- 2. ค้นหารายการรับเข้าทั้งหมดเพื่อทำการลบ
-- ลบรายละเอียดรายการรับเข้าในใบเคลื่อนไหว
DELETE FROM public.stock_movement_items
WHERE movement_id IN (
    SELECT id FROM public.stock_movements WHERE movement_type = 'RECEIVE'
);

-- ลบข้อมูลประวัติการตรวจบันทึกสำหรับการรับเข้าใน Audit Logs
DELETE FROM public.stock_audit_logs
WHERE action_type = 'RECEIVE';

-- 3. ลบหัวเอกสารการรับเข้า
DELETE FROM public.stock_movements
WHERE movement_type = 'RECEIVE';

-- 4. ปรับยอดคงคลัง (Stock Balances) ในล็อตที่มีการรับเข้านั้นให้เป็น 0 หรือลบออกหากยอดเป็น 0
-- ลบข้อมูลล็อตที่ยอดคงเหลือกลับเป็น 0
DELETE FROM public.stock_balances
WHERE current_qty <= 0;

-- 5. กู้คืนระบบล็อกประวัติความปลอดภัย
CREATE RULE protect_audit_logs_update AS 
ON UPDATE TO public.stock_audit_logs 
DO INSTEAD NOTHING;

CREATE RULE protect_audit_logs_delete AS 
ON DELETE TO public.stock_audit_logs 
DO INSTEAD NOTHING;

COMMIT;
*/
