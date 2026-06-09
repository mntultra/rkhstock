-- SQL Update script สำหรับแก้ไข role_key ในตาราง default_officers
-- นำไฟล์นี้ไปรันใน Supabase SQL Editor

UPDATE default_officers SET role_key = 'head_main_warehouse' WHERE role_key = 'head_warehouse';
UPDATE default_officers SET role_key = 'dispenser_main_warehouse' WHERE role_key = 'dispenser_main';
UPDATE default_officers SET role_key = 'approver_main_warehouse' WHERE role_key = 'approver';
UPDATE default_officers SET role_key = 'dispenser_sub_warehouse' WHERE role_key = 'dispenser';
