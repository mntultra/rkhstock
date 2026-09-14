-- =========================================================================
-- Migration 46: อัปเดตยอด received_qty สำหรับใบเบิกประวัติศาสตร์ที่มีสถานะ COMPLETED
-- แต่ยอด received_qty เป็น 0 ทั้งหมด และไม่มีใบรับสินค้าแยกต่างหาก
-- =========================================================================

-- 1. อัปเดต requisition_items ให้ received_qty เท่ากับ qty สำหรับใบเบิกที่ COMPLETED
-- และผลรวม received_qty ทั้งใบเบิกเป็น 0 และไม่มี stock_movements ผูกไว้
UPDATE public.requisition_items ri
SET received_qty = ri.qty
FROM public.requisitions r
WHERE ri.requisition_id = r.id
  AND r.status = 'COMPLETED'
  AND (
    SELECT COALESCE(SUM(ri2.received_qty), 0)
    FROM public.requisition_items ri2
    WHERE ri2.requisition_id = r.id
  ) = 0
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements sm
    WHERE (sm.requisition_id = r.id OR sm.reference_doc_no = r.doc_no)
      AND sm.movement_type = 'RECEIVE'
      AND COALESCE(sm.is_voided, false) = false
  );
