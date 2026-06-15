import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Upload, X, FileSpreadsheet, AlertCircle, Download, Database, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useOfficers } from '@/hooks/useOfficers';
import { useWarehouses } from '@/hooks/useWarehouses';

interface IssueRelationalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function IssueRelationalImportModal({ isOpen, onClose, onSuccess }: IssueRelationalImportModalProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'preview' | 'importing'>('upload');
  const [error, setError] = useState('');
  const [parsedGroups, setParsedGroups] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { officers } = useOfficers();
  const { warehouses } = useWarehouses();

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setError('');
      setParsedGroups([]);
      setProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseExcelDate = (val: any) => {
    if (!val) return '';
    if (typeof val === 'number') {
      const d = new Date((val - (25567 + 2)) * 86400 * 1000);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return val;
    }
    return '';
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const headers = [
      ['doc_no', 'doc_date', 'from_warehouse', 'to_warehouse', 'issuer', 'note'],
      ['ISS-2026-001', '31/12/2026', 'คลังยาหลัก', 'คลังยาย่อย', 'ชื่อผู้จ่าย', 'นำเข้าประวัติย้อนหลัง']
    ];
    
    const items = [
      ['doc_no', 'drug_code', 'qty', 'lot_number', 'remark'],
      ['ISS-2026-001', '1000001', 500, 'L26001', 'เบิกปกติ'],
      ['ISS-2026-001', '1000002', 100, 'L26002', '']
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headers), 'ใบตัดจ่าย (Headers)');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(items), 'รายการ (Items)');
    XLSX.writeFile(wb, 'RKHSTOCK_Issue_Import_Relational_Template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep('processing');
    setError('');

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      
      const headerSheet = wb.Sheets['ใบตัดจ่าย (Headers)'];
      const itemsSheet = wb.Sheets['รายการ (Items)'];

      if (!headerSheet || !itemsSheet) {
        throw new Error('ไม่พบโครงสร้างชีตที่ถูกต้อง (ต้องมี "ใบตัดจ่าย (Headers)" และ "รายการ (Items)")');
      }

      const hRows = XLSX.utils.sheet_to_json<any>(headerSheet);
      const iRows = XLSX.utils.sheet_to_json<any>(itemsSheet);

      if (hRows.length === 0) throw new Error('ไม่พบข้อมูลในชีต ใบตัดจ่าย (Headers)');
      if (iRows.length === 0) throw new Error('ไม่พบข้อมูลในชีต รายการ (Items)');

      // Fetch all products
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, drug_code, generic_name, pack_size, unit_price, unit_id:unit_id(name:unit_name)')
        .eq('is_active', true);

      const prodMap = new Map();
      if (dbProducts) {
        dbProducts.forEach(p => prodMap.set(String(p.drug_code).trim(), p));
      }

      // We might need stock balances to get existing expiry_date and unit_price for the issued lot
      const { data: rawStockBalances } = await supabase
        .from('stock_balances')
        .select('product_id, warehouse_id, current_qty, lots(lot_number, expiry_date, unit_price)');
        
      const stockBalances = (rawStockBalances || []).map((b: any) => ({
        product_id: b.product_id,
        warehouse_id: b.warehouse_id,
        current_qty: b.current_qty,
        lot_number: b.lots?.lot_number,
        expiry_date: b.lots?.expiry_date,
        unit_price: b.lots?.unit_price
      }));
        
      const groups = [];
      const seenDocs = new Set();

      for (const hRow of hRows) {
        if (!hRow.doc_no) continue;
        const docNo = String(hRow.doc_no).trim();
        
        if (seenDocs.has(docNo)) continue;
        seenDocs.add(docNo);

        // Matching
        const normalizeStr = (s: string) => (s || '').replace(/\s+/g, '').replace(/^(นาย|นาง|นางสาว)/, '');
        const findWh = (n: string) => {
          if (!n) return null;
          const search = normalizeStr(String(n));
          return warehouses.find(w => normalizeStr(w.name).includes(search))?.id || null;
        };
        const findOff = (n: string) => {
          if (!n) return null;
          const search = normalizeStr(String(n));
          return officers.find(o => {
            const oname = normalizeStr(o.full_name);
            return oname.includes(search) || search.includes(oname);
          })?.id || null;
        };

        const fromWhId = hRow.from_warehouse ? findWh(hRow.from_warehouse) : null;
        const toWhId = hRow.to_warehouse ? findWh(hRow.to_warehouse) : null;

        const groupItems = iRows.filter(i => String(i.doc_no).trim() === docNo).map(iRow => {
          const code = String(iRow.drug_code).trim();
          const pData = prodMap.get(code);

          const normalizedLot = String(iRow.lot_number || '').trim() || '-';
          
          // Try to find matching lot in stock balances to grab expiry_date and unit_price
          let expDate = null;
          let uPrice = pData?.unit_price || 0;
          if (pData && fromWhId) {
             const matchingLots = stockBalances?.filter(
               b => b.product_id === pData.id && b.warehouse_id === fromWhId && b.lot_number === normalizedLot
             ) || [];
             
             if (matchingLots.length > 0) {
                 // Sort by expiry_date ASC (FEFO) to find the earliest expiring lot
                 matchingLots.sort((a, b) => {
                     if (!a.expiry_date) return 1;
                     if (!b.expiry_date) return -1;
                     return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                 });
                 // Choose the first lot with positive stock, or fallback to the first lot
                 const firstWithStock = matchingLots.find(b => b.current_qty > 0) || matchingLots[0];
                 expDate = firstWithStock.expiry_date;
                 uPrice = firstWithStock.unit_price;

                 // Deduct the quantity in-memory so subsequent rows of the same product/lot can pick the next available lot
                 const qtyToDeduct = Number(iRow.qty) || 0;
                 firstWithStock.current_qty = Math.max(0, firstWithStock.current_qty - qtyToDeduct);
             }
          }

          return {
            drug_code: code,
            qty: Number(iRow.qty) || 0,
            lot_number: normalizedLot,
            expiry_date: expDate,
            unit_price: uPrice,
            remark: String(iRow.remark || '').trim(),
            product: pData || null
          };
        });

        groups.push({
          doc_no: docNo,
          doc_date: parseExcelDate(hRow.doc_date) || new Date().toISOString().split('T')[0],
          from_warehouse_id: fromWhId,
          to_warehouse_id: toWhId,
          issuer: hRow.issuer ? findOff(hRow.issuer) : null,
          note: String(hRow.note || '').trim(),
          items: groupItems,
          isValid: groupItems.length > 0 && groupItems.every(i => i.product && i.lot_number && i.qty > 0) && fromWhId && toWhId && hRow.issuer
        });
      }

      setParsedGroups(groups);
      setStep('preview');

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      setStep('upload');
    }
    
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    setStep('importing');
    setError('');
    
    const validGroups = parsedGroups.filter(g => g.isValid);
    let successCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบเซสชั่น');

      const creator = officers.find(o => o.id === user.id);

      for (let i = 0; i < validGroups.length; i++) {
        const group = validGroups[i];

        // 1. Insert Movement
        const { data: movement, error: movError } = await supabase
          .from('stock_movements')
          .insert({
            movement_type: 'ISSUE',
            doc_no: group.doc_no,
            doc_date: group.doc_date,
            from_warehouse_id: group.from_warehouse_id,
            to_warehouse_id: group.to_warehouse_id,
            actor_id: group.issuer,
            note: group.note,
            created_by: user.id,
            created_by_position: creator?.position || null
          })
          .select('id')
          .single();
        
        if (movError) throw movError;

        // 2. Insert Items และอ้างอิง Lot (qty should be positive)
        const itemsToInsert = [];
        for (const it of group.items) {
          const { data: lotId, error: lotError } = await supabase.rpc('find_or_create_lot', {
              p_product_id: it.product.id,
              p_lot_number: it.lot_number,
              p_expiry_date: it.expiry_date,
              p_unit_price: it.unit_price || 0
          });
          if (lotError) throw lotError;

          itemsToInsert.push({
            movement_id: movement.id,
            product_id: it.product.id,
            lot_id: lotId,
            qty: Number(it.qty),
            pack_size: it.product.pack_size || 1,
            unit_name: it.product.unit_id?.name || '',
            unit_price: it.unit_price,
            remark: it.remark || null
          });
        }

        const { error: itemsError } = await supabase.from('stock_movement_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // 3. Update Stock Balances (Deduct)
        for (const item of group.items) {
           const { error: deductError } = await supabase.rpc('deduct_stock_balance', {
             p_product_id: item.product.id,
             p_warehouse_id: group.from_warehouse_id,
             p_lot_number: item.lot_number,
             p_expiry_date: item.expiry_date || null,
             p_qty: Number(item.qty)
           });
           
           if (deductError) {
              throw new Error(`ไม่สามารถหักยอดสต็อก ${item.drug_code} Lot ${item.lot_number} ได้: ${deductError.message}`);
           }
        }

        successCount++;
        setProgress(Math.round((successCount / validGroups.length) * 100));
      }

      // alert(`นำเข้าสำเร็จ ${successCount} ใบตัดจ่าย!`); // Handled by onSuccess callback
      onSuccess();
      onClose();

    } catch (err: any) {
      setError(`ข้อผิดพลาดขณะนำเข้า (ใบที่ ${successCount + 1}): ${err.message}`);
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div onClick={() => !['processing', 'importing'].includes(step) && onClose()}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" />
      <div className="relative w-full max-w-5xl bg-white border border-gray-100 rounded-3xl p-6 shadow-2xl z-10 animate-fade-in flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              <Database className="text-emerald-600" size={24} />
              นำเข้าประวัติใบตัดจ่ายย้อนหลังแบบหลายบิล (Multi-Doc Bulk Import)
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              ระบบนำเข้าข้อมูลดิบเข้าสู่ฐานข้อมูลโดยตรง พร้อมหักสต๊อกตามข้อมูล
            </p>
          </div>
          <button onClick={onClose} disabled={['processing', 'importing'].includes(step)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 relative px-1">
          {step === 'upload' && (
            <div className="space-y-6">
              {error && <Alert type="error" message={error} />}
              
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-emerald-800 mb-2">คำแนะนำการใช้งานแบบ Relational</h3>
                <ol className="list-decimal list-inside text-sm text-emerald-700/80 space-y-1 font-medium">
                  <li>ระบบนี้ใช้สำหรับการสร้างบิล **หลายๆ ใบพร้อมกัน** ลงในฐานข้อมูล</li>
                  <li>ไฟล์จะมี 2 ชีต: <span className="font-bold text-emerald-900">ใบตัดจ่าย (Headers)</span> และ <span className="font-bold text-emerald-900">รายการ (Items)</span></li>
                  <li>เชื่อมความสัมพันธ์กันด้วยคอลัมน์ <code className="bg-emerald-100 px-1 rounded text-emerald-900">doc_no</code> (สำหรับจัดกลุ่ม)</li>
                  <li>เมื่อนำเข้าสำเร็จ ข้อมูลจะถูกดึงเข้าประวัติคลัง และหักยอดสต๊อกทันที</li>
                </ol>
                <button type="button" onClick={handleDownloadTemplate}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors text-xs font-bold shadow-sm">
                  <Download size={14} /> ดาวน์โหลดไฟล์ Template (.xlsx)
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors relative">
                <input type="file" ref={fileRef} accept=".xlsx, .xls, .csv" onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center text-emerald-500 mb-4">
                  <FileSpreadsheet size={32} />
                </div>
                <p className="text-sm font-extrabold text-gray-700">คลิก หรือ ลากไฟล์มาวางที่นี่</p>
                <p className="text-xs text-gray-400 font-medium mt-1">รองรับไฟล์ .xlsx</p>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-gray-600 font-bold">กำลังอ่านข้อมูลจากไฟล์...</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {error && <Alert type="error" message={error} />}
              <div className="flex justify-between items-center bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100">
                <p className="text-sm font-extrabold text-emerald-800">
                  พบข้อมูลบิลทั้งหมด: <span className="text-lg text-emerald-600">{parsedGroups.length}</span> ใบ
                  (พร้อมนำเข้า <span className="text-emerald-600">{parsedGroups.filter(g => g.isValid).length}</span> ใบ)
                </p>
              </div>
              
              <div className="space-y-4">
                {parsedGroups.map((g, i) => (
                  <div key={i} className={`border rounded-xl p-4 ${g.isValid ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-start mb-3 gap-4">
                      <div className="flex-1">
                        <h4 className="font-extrabold text-gray-900 flex items-center gap-2 mb-2">
                          {g.doc_no}
                          {g.isValid ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-1.5 gap-x-4 text-xs text-gray-600 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <p><span className="font-semibold text-gray-500">วันที่ตัดจ่าย:</span> <span className="font-bold text-gray-900">{g.doc_date}</span></p>
                          <p><span className="font-semibold text-gray-500">คลังต้นทาง:</span> <span className="font-bold text-gray-900">{g.from_warehouse_id ? warehouses.find(w => w.id === g.from_warehouse_id)?.name : <span className="text-red-500">ไม่ระบุ/ไม่พบ</span>}</span></p>
                          <p><span className="font-semibold text-gray-500">คลังปลายทาง:</span> <span className="font-bold text-gray-900">{g.to_warehouse_id ? warehouses.find(w => w.id === g.to_warehouse_id)?.name : <span className="text-red-500">ไม่ระบุ/ไม่พบ</span>}</span></p>
                          <p><span className="font-semibold text-gray-500">ผู้จ่าย:</span> <span className="font-bold text-gray-900">{g.issuer ? officers.find(o => o.id === g.issuer)?.full_name : <span className="text-red-500">ไม่ระบุ/ไม่พบ</span>}</span></p>
                          
                          {g.note && <p className="col-span-2 lg:col-span-4 mt-1"><span className="font-semibold text-gray-500">หมายเหตุ:</span> <span className="font-bold text-gray-900">{g.note}</span></p>}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full whitespace-nowrap border border-emerald-100">{g.items.length} รายการ</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="py-1 px-2">รหัสยา</th>
                            <th className="py-1 px-2 text-right">จำนวน</th>
                            <th className="py-1 px-2">Lot</th>
                            <th className="py-1 px-2">สถานะยา</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {g.items.map((it: any, idx: number) => (
                            <tr key={idx} className={(!it.product || !it.lot_number || it.qty <= 0) ? 'bg-red-50' : ''}>
                              <td className="py-1.5 px-2 font-mono">{it.drug_code}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-emerald-600">{it.qty}</td>
                              <td className="py-1.5 px-2">{it.lot_number || '-'}</td>
                              <td className="py-1.5 px-2">
                                {it.product ? 'OK' : <span className="text-red-500">ไม่พบรหัส</span>}
                                {it.qty <= 0 && <span className="text-red-500 ml-2">(จำนวน &lt;= 0)</span>}
                                {!it.lot_number && <span className="text-red-500 ml-2">(ไม่มี Lot)</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-gray-900 font-black text-lg">กำลังบันทึกลงฐานข้อมูล</p>
                <p className="text-emerald-600 font-bold text-2xl mt-2">{progress}%</p>
              </div>
              <div className="w-full max-w-md h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={() => setStep('upload')}>ย้อนกลับ</Button>
            <Button 
              onClick={handleConfirmImport} 
              disabled={parsedGroups.filter(g => g.isValid).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6"
            >
              ยืนยันการนำเข้าข้อมูล {parsedGroups.filter(g => g.isValid).length} ใบ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
