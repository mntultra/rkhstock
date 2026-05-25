import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProductSearchInput from '@/components/ProductSearchInput';
import { ArrowDownToLine, CheckCircle2, Plus, Trash2, Calendar, FileSpreadsheet, Save } from 'lucide-react';

interface ReceiveItem {
  id: string; // คีย์ชั่วคราวสำหรับ UI
  product: any | null; // ข้อมูลยาที่เลือก
  lot_number: string;
  expiry_date: string;
  qty: number | '';
}

export default function ReceiveForm() {
  // เริ่มต้นด้วย 1 แถวว่างเปล่าในตาราง
  const [items, setItems] = useState<ReceiveItem[]>([
    { id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '' }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // เพิ่มแถวใหม่ลงตาราง
  const handleAddRow = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '' }
    ]);
  };

  // ลบแถวออกจากตาราง
  const handleRemoveRow = (id: string) => {
    if (items.length === 1) {
      // ถ้าเหลือแถวสุดท้าย ให้กดลบเป็นการเคลียร์ข้อมูลในแถวแทนการลบแถว
      setItems([{ id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '' }]);
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  // อัปเดตข้อมูลในแต่ละฟิลด์ของแถว
  const handleUpdateRow = (id: string, field: keyof ReceiveItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // บันทึกใบรับยาเข้าคลัง
  const handleSaveVoucher = async () => {
    // กรองเฉพาะแถวที่มีการกรอกข้อมูลครบถ้วน
    const validItems = items.filter(item => item.product && item.lot_number && item.expiry_date && item.qty !== '');
    
    if (validItems.length === 0) {
      alert('กรุณากรอกข้อมูลยา, Lot, วันหมดอายุ และจำนวน ให้ครบถ้วนอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบเซสชั่นการล็อกอิน");

      // 1. สร้างหัวใบรับเพียงใบเดียว (1 Movement)
      const { data: movement, error: movError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'RECEIVE',
          created_by: user.id
        })
        .select('id')
        .single();
      
      if (movError) throw movError;

      // 2. เตรียมรายการยาทั้งหมดเพื่อ Bulk Insert
      const itemsToInsert = validItems.map(item => ({
        movement_id: movement.id,
        product_id: item.product.id,
        lot_number: item.lot_number,
        expiry_date: item.expiry_date,
        qty: Number(item.qty)
      }));

      const { error: itemsError } = await supabase
        .from('stock_movement_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // สำเร็จ
      setSuccessMsg(`บันทึกใบรับยาเข้าคลังสำเร็จ! รวมทั้งหมด ${validItems.length} รายการ`);
      // รีเซ็ตตารางกลับไปเป็น 1 แถวว่างเปล่า
      setItems([{ id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '' }]);
      
      setTimeout(() => setSuccessMsg(''), 5000);
      
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-up">
          <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={24} />
          <span className="font-extrabold">{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <ArrowDownToLine size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">บันทึกใบรับยาเข้าคลัง</h1>
            <p className="text-gray-500 font-medium">กรอกข้อมูลรับเข้าเวชภัณฑ์เป็นแถวตาราง ทำงานได้รวดเร็วและต่อเนื่อง</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold border border-emerald-100 self-start md:self-auto">
          <FileSpreadsheet size={20} />
          <span>ใบรับยาแบบตาราง (Inline Row)</span>
        </div>
      </div>

      {/* ตารางรับยาแบบแถวตาราง */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/40 p-6 space-y-6 overflow-visible">
        
        <div className="overflow-x-auto min-h-[350px] overflow-visible">
          <table className="w-full text-left border-collapse text-sm overflow-visible">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider">
                <th className="py-3 px-2 w-10 text-center">#</th>
                <th className="py-3 px-3 w-[35%]">1. ค้นหาและเลือกเวชภัณฑ์</th>
                <th className="py-3 px-3 w-[20%]">2. Lot Number</th>
                <th className="py-3 px-3 w-[20%]">3. วันหมดอายุ</th>
                <th className="py-3 px-3 w-[15%] text-right">4. จำนวน</th>
                <th className="py-3 px-3 w-12 text-center">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 overflow-visible">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors overflow-visible group">
                  {/* ลำดับที่ */}
                  <td className="py-4 px-2 text-center font-bold text-gray-400">
                    {index + 1}
                  </td>
                  
                  {/* ค้นหายา */}
                  <td className="py-4 px-3 overflow-visible relative">
                    {item.product ? (
                      <div className="flex items-center justify-between p-2.5 border-2 border-emerald-400 bg-emerald-50/50 rounded-xl shadow-inner transition-all">
                        <div className="truncate">
                          <p className="font-extrabold text-emerald-900 truncate">{item.product.generic_name}</p>
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">รหัส: {item.product.drug_code}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleUpdateRow(item.id, 'product', null)} 
                          className="ml-2 text-red-500 hover:text-red-700 text-sm font-extrabold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative z-50">
                        <ProductSearchInput onSelect={(prod) => handleUpdateRow(item.id, 'product', prod)} />
                      </div>
                    )}
                  </td>
                  
                  {/* Lot Number */}
                  <td className="py-4 px-3">
                    <input 
                      type="text" 
                      required 
                      value={item.lot_number} 
                      onChange={e => handleUpdateRow(item.id, 'lot_number', e.target.value)}
                      placeholder="เช่น L24001"
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-mono text-sm shadow-sm"
                    />
                  </td>
                  
                  {/* วันหมดอายุ */}
                  <td className="py-4 px-3">
                    <input 
                      type="date" 
                      required 
                      value={item.expiry_date} 
                      onChange={e => handleUpdateRow(item.id, 'expiry_date', e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                    />
                  </td>
                  
                  {/* จำนวน */}
                  <td className="py-4 px-3 text-right">
                    <input 
                      type="number" 
                      min="1" 
                      required 
                      value={item.qty} 
                      onChange={e => handleUpdateRow(item.id, 'qty', e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-lg font-extrabold text-emerald-700 text-center shadow-sm"
                    />
                  </td>
                  
                  {/* ลบแถว */}
                  <td className="py-4 px-3 text-center">
                    <button 
                      onClick={() => handleRemoveRow(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="ลบแถวนี้"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ปุ่มควบคุมแถวและบันทึกใบรับ */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={handleAddRow}
              className="flex-1 sm:flex-initial px-6 py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-2xl hover:border-emerald-500 hover:text-emerald-600 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              <span>เพิ่มแถวยาใหม่</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
            <div className="text-right">
              <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">จำนวนยารับเข้ารวม</p>
              <p className="text-2xl font-extrabold text-gray-800">
                {items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)} <span className="text-sm font-medium text-gray-400">หน่วย</span>
              </p>
            </div>
            
            <button 
              onClick={handleSaveVoucher}
              disabled={isSubmitting || items.length === 0}
              className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-100 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2 text-base"
            >
              <Save size={20} />
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบรับยานี้'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
