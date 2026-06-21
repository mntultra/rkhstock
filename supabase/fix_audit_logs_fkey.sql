-- สคริปต์สำหรับแก้ไข Foreign Key Constraint ในตาราง stock_audit_logs
-- เพื่อให้สามารถลบข้อมูลอ้างอิง (เช่น products, warehouses) ได้เมื่อยังไม่เคยถูกใช้งาน
-- ป้องกัน error: referential integrity query ... gave unexpected result

BEGIN;

-- 1. ลบ Constraint เดิมที่มีปัญหา (ON DELETE CASCADE, ON DELETE SET NULL)
ALTER TABLE stock_audit_logs DROP CONSTRAINT IF EXISTS stock_audit_logs_product_id_fkey;
ALTER TABLE stock_audit_logs DROP CONSTRAINT IF EXISTS stock_audit_logs_warehouse_id_fkey;
ALTER TABLE stock_audit_logs DROP CONSTRAINT IF EXISTS stock_audit_logs_movement_id_fkey;
ALTER TABLE stock_audit_logs DROP CONSTRAINT IF EXISTS stock_audit_logs_performed_by_fkey;

-- 2. สร้าง Constraint ใหม่ด้วย ON DELETE RESTRICT
-- (RESTRICT จะเช็คแค่ว่ามีการใช้งานหรือไม่ ถ้าไม่มีก็ให้ลบได้ แต่ถ้ามีจะแจ้ง error ปกติโดยไม่พยายามอัปเดต/ลบข้อมูลใน stock_audit_logs ซึ่งไปขัดแย้งกับ rule immutable)
ALTER TABLE stock_audit_logs 
  ADD CONSTRAINT stock_audit_logs_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE stock_audit_logs 
  ADD CONSTRAINT stock_audit_logs_warehouse_id_fkey 
  FOREIGN KEY (warehouse_id) REFERENCES master_warehouses(id) ON DELETE RESTRICT;

ALTER TABLE stock_audit_logs 
  ADD CONSTRAINT stock_audit_logs_movement_id_fkey 
  FOREIGN KEY (movement_id) REFERENCES stock_movements(id) ON DELETE RESTRICT;

ALTER TABLE stock_audit_logs 
  ADD CONSTRAINT stock_audit_logs_performed_by_fkey 
  FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

COMMIT;
