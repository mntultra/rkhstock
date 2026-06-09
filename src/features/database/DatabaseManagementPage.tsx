import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Database, Download, AlertCircle, RefreshCw, FileText, Archive, Trash } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function DatabaseManagementPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- Export Table to CSV Function ---
  const handleExportCSV = async (tableName: string, fileName: string) => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('ไม่มีข้อมูลในตารางนี้');
      }

      // Convert JSON to CSV using PapaParse
      const csv = Papa.unparse(data);

      // Create a Blob and trigger download
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel UTF-8 support
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportMessage({ type: 'success', text: `ส่งออกข้อมูลตาราง ${tableName} สำเร็จ (${data.length} รายการ)` });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: `เกิดข้อผิดพลาดในการส่งออก: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  // --- Full System Backup to Multi-sheet Excel Function ---
  const handleBackupAll = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const tables = [
        { name: 'products', sheetName: 'Products (เวชภัณฑ์)' },
        { name: 'officers', sheetName: 'Officers (เจ้าหน้าที่)' },
        { name: 'master_warehouses', sheetName: 'Master Warehouses (คลัง)' },
        { name: 'master_dosage_forms', sheetName: 'Master Dosage Forms (รูปแบบยา)' },
        { name: 'master_product_types', sheetName: 'Master Product Types (ประเภท)' },
        { name: 'master_units', sheetName: 'Master Units (หน่วยนับหลัก)' },
        { name: 'master_fiscal_years', sheetName: 'Master Fiscal Years (ปีงบประมาณ)' },
        { name: 'requisitions', sheetName: 'Requisitions (การขอเบิก)' },
        { name: 'requisition_items', sheetName: 'Requisition Items (รายการเบิก)' },
        { name: 'borrow_records', sheetName: 'Borrow Records (การยืม-คืน)' }
      ];

      const wb = XLSX.utils.book_new();
      let totalRecords = 0;
      let sheetsAdded = 0;

      // Fetch all tables in parallel
      const results = await Promise.all(
        tables.map(t => supabase.from(t.name).select('*'))
      );

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const res = results[i];
        
        // Skip errors or handle them gracefully
        if (res.error) {
          console.warn(`ล้มเหลวในการดึงข้อมูลตาราง ${table.name}:`, res.error.message);
          continue;
        }
        
        const data = res.data || [];
        totalRecords += data.length;
        sheetsAdded++;

        // Convert json to sheet
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, table.sheetName);
      }

      if (sheetsAdded === 0) {
        throw new Error('ไม่สามารถดึงข้อมูลของตารางใด ๆ ในระบบได้');
      }

      // Save complete workbook
      XLSX.writeFile(wb, `RKHSTOCK_COMPLETE_BACKUP_${new Date().toISOString().split('T')[0]}.xlsx`);

      setExportMessage({ 
        type: 'success', 
        text: `สำรองฐานข้อมูลเสร็จสมบูรณ์! ได้รวบรวมข้อมูลจำนวน ${sheetsAdded} ตาราง รวมทั้งสิ้น ${totalRecords} แถวข้อมูล ลงในไฟล์ Excel แบบหลายแผ่นงานเรียบร้อยแล้ว` 
      });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: `เกิดข้อผิดพลาดในการสำรองข้อมูลทั้งหมด: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  // --- Factory Reset ---
  const [isResetting, setIsResetting] = useState(false);
  const handleCustomClean = async () => {
    if (!confirm('⚠️ คำเตือนระดับสูงสุด ⚠️\n\nยืนยันการ "ล้างประวัติการทำธุรกรรมทั้งหมด" เพื่อเริ่มระบบใหม่?\n\n- ลบใบรับ, ใบเบิก, ใบจ่าย, ยืม-คืน ของ "ทุกปีงบประมาณ"\n- ลบยอดสต๊อกคงเหลือทั้งหมด\n\nการกระทำนี้จะล้างข้อมูลการเคลื่อนไหวทั้งหมดให้เป็นศูนย์ ไม่สามารถย้อนกลับได้!')) return;
    
    setIsResetting(true);
    setExportMessage(null);
    try {
      // 1. ลบใบรับ/จ่าย/ปรับยอด/ทำลาย (ทุกประเภท)
      const { error: delMoveErr } = await supabase.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delMoveErr) throw delMoveErr;

      // 2. ลบการขอเบิกทั้งหมด
      const { error: delReqErr } = await supabase.from('requisitions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delReqErr) throw delReqErr;

      // 3. ลบการยืม-คืนทั้งหมด
      const { error: delBorrowErr } = await supabase.from('borrowings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delBorrowErr) throw delBorrowErr;

      // 4. ลบยอดคงคลังทั้งหมด (ลบ Row ออกไปเลย เพื่อเริ่มใหม่หมดจด)
      const { error: delBalErr } = await supabase.from('stock_balances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delBalErr) throw delBalErr;

      setExportMessage({ 
        type: 'success', 
        text: `ล้างประวัติการเบิก รับ จ่าย ยืม-คืน และยอดคงคลังทั้งหมดเรียบร้อยแล้ว ระบบกลับสู่สถานะเริ่มต้นใหม่ทั้งหมด (Factory Reset)` 
      });
    } catch (err: any) {
      setExportMessage({ type: 'error', text: `เกิดข้อผิดพลาดในการล้างข้อมูล: ${err.message}` });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
            <Database size={28} />
          </div>
          จัดการฐานข้อมูล
        </h1>
        <p className="text-gray-500 mt-2">
          ดูแลรักษาและสำรองข้อมูลระบบเพื่อความปลอดภัยสูงสุดของข้อมูลคลังเวชภัณฑ์
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Export Section (Table by Table) --- */}
        <Card className="border-t-4 border-t-emerald-500 shadow-sm" noPadding>
          <div className="p-6">
            <CardHeader 
              title="การสำรองข้อมูลรายตาราง (Table Export)" 
              icon={<Download size={20} className="text-emerald-600" />} 
              className="bg-emerald-50/50 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-gray-100 text-emerald-800" 
            />
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">
                เลือกส่งออกข้อมูลเฉพาะตารางที่ต้องการออกมาเป็นไฟล์ CSV เพื่อวัตถุประสงค์ในการตรวจสอบรายชุดข้อมูล
              </p>

              {exportMessage && exportMessage.text.includes('ตาราง') && (
                <Alert 
                  type={exportMessage.type === 'success' ? 'success' : 'error'}
                  className="mb-4"
                >
                  {exportMessage.text}
                </Alert>
              )}

              <div className="space-y-3">
                {/* Products Table */}
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">รายการเวชภัณฑ์</h3>
                      <p className="text-xs text-gray-500">ตาราง products</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleExportCSV('products', 'ProductsData')}
                    disabled={isExporting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    size="sm"
                  >
                    {isExporting ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    ดาวน์โหลด CSV
                  </Button>
                </div>

                {/* Officers Table */}
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">ข้อมูลเจ้าหน้าที่</h3>
                      <p className="text-xs text-gray-500">ตาราง officers</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleExportCSV('officers', 'OfficersData')}
                    disabled={isExporting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    size="sm"
                  >
                    {isExporting ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    ดาวน์โหลด CSV
                  </Button>
                </div>
                
                {/* Warehouses Table */}
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">คลังสินค้า</h3>
                      <p className="text-xs text-gray-500">ตาราง master_warehouses</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleExportCSV('master_warehouses', 'WarehousesData')}
                    disabled={isExporting}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                    size="sm"
                  >
                    {isExporting ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    ดาวน์โหลด CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* --- Full System Backup Section --- */}
        <Card className="border-t-4 border-t-amber-500 shadow-sm" noPadding>
          <div className="p-6">
            <CardHeader 
              title="การสำรองข้อมูลทั้งหมด (Full System Backup)" 
              icon={<Archive size={20} className="text-amber-600" />} 
              className="bg-amber-50/50 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-gray-100 text-amber-800" 
            />
            <div className="space-y-5 mt-4">
              <p className="text-sm text-gray-600">
                ทำการสำรองข้อมูลทุกตารางที่จำเป็นของระบบ RKHSTOCK ไว้ในไฟล์ Excel เพียงไฟล์เดียว โดยข้อมูลจะถูกจัดแยกเป็นหลายแผ่นงาน (Multi-sheets) เพื่อความสะดวกในการเก็บรักษาหรือย้ายข้อมูล
              </p>

              {exportMessage && !exportMessage.text.includes('ตาราง') && (
                <Alert 
                  type={exportMessage.type === 'success' ? 'success' : 'error'}
                  className="mb-4"
                >
                  {exportMessage.text}
                </Alert>
              )}

              <div className="bg-gray-50/50 p-6 rounded-2xl border border-dashed border-amber-300 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Database size={28} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-800 text-lg">สำรองข้อมูลโครงสร้างและธุรกรรมคลัง</h3>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    รวมทั้งสิ้น 10 ตารางความสัมพันธ์ (เวชภัณฑ์, เจ้าหน้าที่, คลัง, รูปแบบยา, ประเภท, <br/> 
                    หน่วยนับหลัก, ปีงบประมาณ, การขอเบิก, รายการขอเบิก และการยืม-คืน)
                  </p>
                </div>
                
                <div className="pt-2">
                  <Button 
                    onClick={handleBackupAll}
                    disabled={isExporting}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-8 py-3 rounded-xl shadow-md shadow-amber-100 hover:shadow-lg transition-all"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="animate-spin w-5 h-5 mr-2" />
                        กำลังรวบรวมและสร้างไฟล์สำรอง...
                      </>
                    ) : (
                      <>
                        <Archive className="w-5 h-5 mr-2" />
                        ดาวน์โหลดไฟล์สำรองระบบทั้งหมด (.xlsx)
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/50 flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold text-amber-900">แนะนำเพื่อความปลอดภัยสูงสุด</p>
                  <p>ควรดาวน์โหลดไฟล์สำรองข้อมูลแบบครอบคลุมนี้เก็บไว้เป็นประจำอย่างน้อยสัปดาห์ละ 1 ครั้ง หรือทุกครั้งก่อนทำการล้างข้อมูล/เปลี่ยนโครงสร้าง เพื่อป้องกันการสูญหายของธุรกรรมในคลังเภสัชกรรม</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 mt-6">
        <Card className="border-t-4 border-t-red-600 shadow-sm" noPadding>
          <div className="p-6">
            <CardHeader 
              title="ระบบจัดการข้อมูลสำหรับนักพัฒนา (Developer Tools)" 
              icon={<Trash size={20} className="text-red-600" />} 
              className="bg-red-50/50 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-red-100 text-red-800" 
            />
            <div className="mt-4 p-6 bg-red-50/30 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-red-800 text-lg">ล้างประวัติข้อมูลระบบทั้งหมด (Factory Reset)</h3>
                <p className="text-sm text-red-600 mt-1">
                  - ลบใบเบิกเวชภัณฑ์, รับเข้า, จ่ายออก, ยืม-คืน <b>ของทุกปีงบประมาณ</b><br/>
                  - <b>ลบยอดสต๊อกคงเหลือทั้งหมดทิ้งเพื่อเริ่มนับศูนย์ใหม่</b><br/>
                  (รายการชื่อเวชภัณฑ์และข้อมูลผู้ใช้จะยังคงอยู่)
                </p>
              </div>
              <Button 
                onClick={handleCustomClean}
                disabled={isResetting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold whitespace-nowrap"
              >
                {isResetting ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Trash className="w-4 h-4 mr-2" />}
                Factory Reset เริ่มระบบใหม่
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
