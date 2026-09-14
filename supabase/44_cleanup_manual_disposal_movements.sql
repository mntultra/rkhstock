-- Migration 44: Cleanup manual disposal movements from stock_movements and stock_movement_items
-- วัตถุประสงค์: ล้างข้อมูล stock_movements และ stock_movement_items ที่เคยบันทึกจากการจำหน่ายทำลายแบบ MANUAL ในอดีต
-- เพื่อป้องกันไม่ให้รายการ MANUAL ส่งผลกระทบต่อการคำนวณ stock_balances หรือทำให้สต็อกในระบบติดลบ

DO $$
DECLARE
    r RECORD;
    v_manual_movements_count INT;
BEGIN
    -- 1. ตรวจสอบจำนวน stock_movements ที่มี note = 'MANUAL' และ movement_type = 'DISPOSE'
    SELECT COUNT(*) INTO v_manual_movements_count
    FROM public.stock_movements
    WHERE movement_type = 'DISPOSE' AND note = 'MANUAL';

    IF v_manual_movements_count > 0 THEN
        RAISE NOTICE 'Found % manual disposal stock movements to clean up.', v_manual_movements_count;

        -- ลบ stock_movement_items ที่ผูกกับ stock_movements ดังกล่าว
        DELETE FROM public.stock_movement_items
        WHERE movement_id IN (
            SELECT id FROM public.stock_movements
            WHERE movement_type = 'DISPOSE' AND note = 'MANUAL'
        );

        -- ลบ stock_movements header
        DELETE FROM public.stock_movements
        WHERE movement_type = 'DISPOSE' AND note = 'MANUAL';

        RAISE NOTICE 'Cleaned up manual disposal movements successfully.';
    ELSE
        RAISE NOTICE 'No manual disposal stock movements found.';
    END IF;
END $$;
