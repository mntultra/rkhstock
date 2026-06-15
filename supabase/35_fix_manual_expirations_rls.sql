-- =========================================================================
-- Schema Update: Fix RLS Policies for manual_expirations
-- วัตถุประสงค์: ปรับปรุงนโยบายความปลอดภัย (RLS) ของตาราง manual_expirations
-- เพื่อให้ทุกบัญชีผู้ใช้งาน (รวมถึง Guest/Anonymous ในบางกรณี) สามารถอ่านข้อมูลได้
-- เพื่อป้องกันปัญหาการไม่แสดงผลข้อมูล MANUAL TRACK ในรายงานอายุเวชภัณฑ์
-- =========================================================================

-- 1. ลบนโยบายการอ่านแบบเดิมที่อาจจะจำกัดสิทธิ์เฉพาะบางบัญชี
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.manual_expirations;
DROP POLICY IF EXISTS "Allow read access for all users" ON public.manual_expirations;

-- 2. สร้างนโยบายการอ่านใหม่แบบเปิดเผยข้อมูลสาธารณะ (เนื่องจากเป็นข้อมูลสถิติที่ไม่มีความปลอดภัยสูง)
-- เพื่อให้ระบบสามารถดึงข้อมูลรายงานมาแสดงผลได้อย่างสมบูรณ์ในทุกสภาวะการ Login
CREATE POLICY "Allow read access for all users" 
    ON public.manual_expirations FOR SELECT 
    USING (true);

-- 3. ตรวจสอบและอัปเดตนโยบายการเขียนข้อมูล (เขียน/แก้ไข/ลบ) ให้ปลอดภัยสำหรับผู้ใช้งานที่ล็อกอินแล้วเท่านั้น
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow insert for authenticated users" 
    ON public.manual_expirations FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow update for authenticated users" 
    ON public.manual_expirations FOR UPDATE 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow delete for authenticated users" 
    ON public.manual_expirations FOR DELETE 
    TO authenticated 
    USING (true);

-- เคลียร์ Cache ของ PostgREST เพื่ออัปเดตสิทธิ์ระบบ
NOTIFY pgrst, 'reload schema';
