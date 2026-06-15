-- =========================================================================
-- Migration 38: Cleanup default_officers dispense to issue
-- วัตถุประสงค์: 
--   แก้ไข role_key เก่าที่มีคำว่า dispenser ในตาราง default_officers ให้เป็น issuer 
--   และลบของเก่าทิ้งเพื่อไม่ให้เกิดข้อมูลขยะ (Orphaned data) 
-- วิธีใช้: คัดลอกโค้ดนี้ไปรันใน Supabase SQL Editor
-- =========================================================================

DO $$
DECLARE
    old_user_id UUID;
BEGIN
    -- 1. จัดการ dispenser_main_warehouse -> issuer_main_warehouse
    IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'dispenser_main_warehouse') THEN
        -- ดึงค่า user_id จากอันเก่า
        SELECT user_id INTO old_user_id FROM public.default_officers WHERE role_key = 'dispenser_main_warehouse';
        
        -- ดูว่ามีอันใหม่หรือยัง
        IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer_main_warehouse') THEN
            -- มีอันใหม่แล้ว อัปเดต user_id เข้าไป (ถ้ามีค่า)
            IF old_user_id IS NOT NULL THEN
                UPDATE public.default_officers SET user_id = old_user_id WHERE role_key = 'issuer_main_warehouse' AND user_id IS NULL;
            END IF;
            -- ลบอันเก่าทิ้ง
            DELETE FROM public.default_officers WHERE role_key = 'dispenser_main_warehouse';
        ELSE
            -- ถ้ายังไม่มีอันใหม่ ให้เปลี่ยนชื่อเลย
            UPDATE public.default_officers SET role_key = 'issuer_main_warehouse' WHERE role_key = 'dispenser_main_warehouse';
        END IF;
    END IF;

    -- 2. จัดการ dispenser_sub_warehouse -> issuer_sub_warehouse
    IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'dispenser_sub_warehouse') THEN
        -- ดึงค่า user_id จากอันเก่า
        SELECT user_id INTO old_user_id FROM public.default_officers WHERE role_key = 'dispenser_sub_warehouse';
        
        -- ดูว่ามีอันใหม่หรือยัง
        IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer_sub_warehouse') THEN
            -- มีอันใหม่แล้ว อัปเดต user_id เข้าไป (ถ้ามีค่า)
            IF old_user_id IS NOT NULL THEN
                UPDATE public.default_officers SET user_id = old_user_id WHERE role_key = 'issuer_sub_warehouse' AND user_id IS NULL;
            END IF;
            -- ลบอันเก่าทิ้ง
            DELETE FROM public.default_officers WHERE role_key = 'dispenser_sub_warehouse';
        ELSE
            -- ถ้ายังไม่มีอันใหม่ ให้เปลี่ยนชื่อเลย
            UPDATE public.default_officers SET role_key = 'issuer_sub_warehouse' WHERE role_key = 'dispenser_sub_warehouse';
        END IF;
    END IF;

    -- 3. ตรวจสอบ issuer_main เผื่อยังมีหลงเหลือ
    IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer_main') THEN
        SELECT user_id INTO old_user_id FROM public.default_officers WHERE role_key = 'issuer_main';
        IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer_main_warehouse') THEN
            IF old_user_id IS NOT NULL THEN
                UPDATE public.default_officers SET user_id = old_user_id WHERE role_key = 'issuer_main_warehouse' AND user_id IS NULL;
            END IF;
            DELETE FROM public.default_officers WHERE role_key = 'issuer_main';
        ELSE
            UPDATE public.default_officers SET role_key = 'issuer_main_warehouse' WHERE role_key = 'issuer_main';
        END IF;
    END IF;
    
    -- 4. ตรวจสอบ approver เผื่อยังมีหลงเหลือ
    IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'approver') THEN
        SELECT user_id INTO old_user_id FROM public.default_officers WHERE role_key = 'approver';
        IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'approver_main_warehouse') THEN
            IF old_user_id IS NOT NULL THEN
                UPDATE public.default_officers SET user_id = old_user_id WHERE role_key = 'approver_main_warehouse' AND user_id IS NULL;
            END IF;
            DELETE FROM public.default_officers WHERE role_key = 'approver';
        ELSE
            UPDATE public.default_officers SET role_key = 'approver_main_warehouse' WHERE role_key = 'approver';
        END IF;
    END IF;

    -- 5. ตรวจสอบ issuer เฉยๆ เผื่อยังมีหลงเหลือ
    IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer') THEN
        SELECT user_id INTO old_user_id FROM public.default_officers WHERE role_key = 'issuer';
        IF EXISTS (SELECT 1 FROM public.default_officers WHERE role_key = 'issuer_sub_warehouse') THEN
            IF old_user_id IS NOT NULL THEN
                UPDATE public.default_officers SET user_id = old_user_id WHERE role_key = 'issuer_sub_warehouse' AND user_id IS NULL;
            END IF;
            DELETE FROM public.default_officers WHERE role_key = 'issuer';
        ELSE
            UPDATE public.default_officers SET role_key = 'issuer_sub_warehouse' WHERE role_key = 'issuer';
        END IF;
    END IF;

END $$;
