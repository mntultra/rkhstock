-- =========================================================================
-- Fix RLS Delete Policy for Requisition Items
-- =========================================================================
-- อนุญาตให้ผู้ใช้งานที่ล็อกอินแล้ว (authenticated) สามารถลบรายการใบเบิกได้
-- เพื่อให้ระบบสามารถลบรายการเดิม และเพิ่มรายการใหม่เมื่อมีการแก้ไขใบเบิก (Edit Mode)

CREATE POLICY "Enable delete for authenticated users on requisition_items" 
ON public.requisition_items 
FOR DELETE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users on requisitions" 
ON public.requisitions 
FOR DELETE 
USING (auth.role() = 'authenticated');
