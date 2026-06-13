import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Warehouse, StockBalance } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import { DatePicker } from '@/components/ui/DatePicker';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { 
  Edit3, 
  Save, 
  Plus, 
  Trash2,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import ProductSearchInput from '@/components/ProductSearchInput';

interface ManualAdjustRow {
  id: string;
  type: 'ADD' | 'DEDUCT';
  product: any | null;
  lot_number: string;
  lot_id?: string;
  expiry_date: string;
  unit_price: number | '';
  qty: number | '';
  reason: string;
  available_lots?: any[];
}

export default function ManualAdjustSection() {
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers } = useOfficers();
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const initialId = useRef(crypto.randomUUID());
  const [rows, setRows] = useState<ManualAdjustRow[]>([
    {
      id: initialId.current,
      type: 'ADD',
      product: null,
      lot_number: '',
      expiry_date: '',
      unit_price: '',
      qty: '',
      reason: ''
    }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. กำหนดคลังเริ่มต้น
  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  const handleWarehouseChange = (id: string) => {
    setWarehouseId(id);
    // รีเซ็ตแถวเมื่อเปลี่ยนคลัง เพราะ lot ที่มีให้เลือกของ DEDUCT จะเปลี่ยนไป
    setRows([{
      id: crypto.randomUUID(),
      type: 'ADD',
      product: null,
      lot_number: '',
      expiry_date: '',
      unit_price: '',
      qty: '',
      reason: ''
    }]);
  };

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: 'ADD',
        product: null,
        lot_number: '',
        expiry_date: '',
        unit_price: '',
        qty: '',
        reason: ''
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([{
        id: crypto.randomUUID(),
        type: 'ADD',
        product: null,
        lot_number: '',
        expiry_date: '',
        unit_price: '',
        qty: '',
        reason: ''
      }]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleClearProduct = (id: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return {
          ...row,
          product: null,
          lot_number: '',
          lot_id: undefined,
          expiry_date: '',
          unit_price: '',
          qty: '',
          available_lots: []
        };
      }
      return row;
    }));
  };

  const fetchAvailableLots = async (productId: string, whId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock_balances')
        .select(`
          id, current_qty, lots!inner(id, lot_number, expiry_date, unit_price), product_id, warehouse_id
        `)
        .eq('warehouse_id', whId)
        .eq('product_id', productId)
        .gt('current_qty', 0)
        .order('expiry_date', { ascending: true, referencedTable: 'lots' });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching available lots:', err);
      return [];
    }
  };

  const updateRow = (id: string, field: keyof ManualAdjustRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleProductSelect = async (rowId: string, product: any, currentType: 'ADD' | 'DEDUCT') => {
    // อัปเดต product ทันที
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return { 
          ...row, 
          product,
          lot_number: '',
          lot_id: undefined,
          expiry_date: '',
          unit_price: product?.unit_price || '',
          available_lots: []
        };
      }
      return row;
    }));

    if (product && currentType === 'DEDUCT' && warehouseId) {
      const lots = await fetchAvailableLots(product.id, warehouseId);
      setRows(prev => prev.map(row => {
        if (row.id === rowId) {
          return { ...row, available_lots: lots };
        }
        return row;
      }));
    }
  };

  const handleTypeChange = async (rowId: string, newType: 'ADD' | 'DEDUCT') => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { 
          ...r, 
          type: newType,
          lot_number: '',
          lot_id: undefined,
          expiry_date: '',
          available_lots: []
        };
      }
      return r;
    }));

    if (newType === 'DEDUCT' && row.product && warehouseId) {
      const lots = await fetchAvailableLots(row.product.id, warehouseId);
      setRows(prev => prev.map(r => {
        if (r.id === rowId) {
          return { ...r, available_lots: lots };
        }
        return r;
      }));
    }
  };

  const handleLotSelect = (rowId: string, lotId: string) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId && row.available_lots) {
        const selectedLot = row.available_lots.find(l => l.lots.id === lotId);
        if (selectedLot) {
          return {
            ...row,
            lot_id: selectedLot.lots.id,
            lot_number: selectedLot.lots.lot_number,
            expiry_date: selectedLot.lots.expiry_date,
            unit_price: selectedLot.lots.unit_price || row.product?.unit_price || 0,
            qty: '' // เคลียร์ยอดใหม่กันพลาด
          };
        }
      }
      return row;
    }));
  };

  const handleSave = async () => {
    // 1. Validation
    const validRows = rows.filter(r => r.product && r.qty !== '' && Number(r.qty) > 0 && r.reason.trim() !== '');
    
    if (validRows.length === 0) {
      alert('กรุณากรอกข้อมูล เวชภัณฑ์, จำนวน (>0) และ เหตุผล ให้ครบถ้วนอย่างน้อย 1 รายการ');
      return;
    }

    for (const row of validRows) {
      if (row.type === 'ADD') {
        if (!row.lot_number || !row.expiry_date) {
          alert(`กรุณาระบุเลข Lot และวันหมดอายุสำหรับรายการ: ${row.product?.generic_name}`);
          return;
        }
      } else {
        if (!row.lot_id) {
          alert(`กรุณาเลือก Lot ที่ต้องการลดสต๊อกสำหรับรายการ: ${row.product?.generic_name}`);
          return;
        }
        const lotInfo = row.available_lots?.find(l => l.lots.id === row.lot_id);
        if (lotInfo && Number(row.qty) > Number(lotInfo.current_qty)) {
          alert(`ยอดลดสต๊อก (${row.qty}) เกินกว่ายอดคงเหลือ (${lotInfo.current_qty}) สำหรับรายการ: ${row.product?.generic_name} Lot: ${row.lot_number}`);
          return;
        }
      }
    }

    if (!confirm(`ยืนยันการปรับยอดแมนวลทั้งหมด ${validRows.length} รายการ? (ประวัติจะถูกบันทึกในระบบ)`)) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('ไม่พบข้อมูลเซสชั่นผู้ใช้ กรุณาล็อกอินใหม่');

      const creator = officers.find(s => s.id === userId);

      // สร้างหัวเอกสาร
      const { data: movement, error: movError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'ADJUST',
          from_warehouse_id: warehouseId,
          created_by: userId,
          created_by_position: creator?.position || null,
          doc_date: docDate
        })
        .select('id')
        .single();

      if (movError) throw movError;

      // จัดการทีละแถว
      for (const row of validRows) {
        const isAdd = row.type === 'ADD';
        const qtyToRecord = isAdd ? Number(row.qty) : -Math.abs(Number(row.qty));

        let finalLotId = row.lot_id;
        
        // ถ้าเป็น ADD, ให้หาหรือสร้าง lot ก่อน เพื่อให้ได้ lot_id มาใช้
        if (isAdd) {
          const { data: lotId, error: lotError } = await supabase.rpc('find_or_create_lot', {
            p_product_id: row.product.id,
            p_lot_number: row.lot_number,
            p_expiry_date: row.expiry_date,
            p_unit_price: Number(row.unit_price) || 0
          });
          if (lotError) throw lotError;
          finalLotId = lotId;
        }

        // 1. สร้าง movement item
        const { error: itemError } = await supabase
          .from('stock_movement_items')
          .insert({
            movement_id: movement.id,
            product_id: row.product.id,
            lot_id: finalLotId,
            unit_price: Number(row.unit_price) || 0,
            qty: qtyToRecord,
            pack_size: row.product.pack_size || 1,
            unit_name: row.product.unit_id?.name || '',
            remark: row.reason // บันทึกเหตุผลลงช่อง remark
          });

        if (itemError) throw itemError;

        // 2. ปรับยอดคงเหลือหลักด้วย RPC
        if (isAdd) {
          const { error: rpcError } = await supabase.rpc('add_stock_balance', {
            p_product_id: row.product.id,
            p_warehouse_id: warehouseId,
            p_lot_number: row.lot_number,
            p_expiry_date: row.expiry_date,
            p_unit_price: Number(row.unit_price) || 0,
            p_qty: Number(row.qty)
          });
          if (rpcError) throw rpcError;
        } else {
          const { error: rpcError } = await supabase.rpc('deduct_stock_balance', {
            p_product_id: row.product.id,
            p_warehouse_id: warehouseId,
            p_lot_number: row.lot_number,
            p_expiry_date: row.expiry_date, // ส่งเพื่อให้ตัดตรงล็อตแม่นยำ 100%
            p_qty: Number(row.qty)
          });
          if (rpcError) throw rpcError;
        }
      }

      setSuccessMsg(`บันทึกการปรับยอดสำเร็จเรียบร้อย! ${validRows.length} รายการ`);
      setRows([{
        id: crypto.randomUUID(),
        type: 'ADD',
        product: null,
        lot_number: '',
        expiry_date: '',
        unit_price: '',
        qty: '',
        reason: ''
      }]);
      
      // Auto-hide success msg
      setTimeout(() => setSuccessMsg(''), 5000);

    } catch (err: any) {
      console.error('Error saving manual adjustment:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      {successMsg && (
        <Alert type="success" message={successMsg} />
      )}

      {/* Header */}
      <Card className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <Edit3 size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">ปรับยอดคลังแมนนวล (Manual Adjust)</h1>
            <p className="text-gray-500 font-medium">เพิ่ม-ลดยอดแบบอิสระ พร้อมสร้าง Lot ใหม่ได้ (พร้อมบันทึกเหตุผล)</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-4 self-start lg:self-auto w-full sm:w-auto">
          {/* Group 1: Date */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="text-sm font-bold text-gray-500 shrink-0">
              วันที่ทำรายการ:
            </div>
            <DatePicker
              value={docDate}
              onChange={setDocDate}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 outline-none transition-all text-sm font-bold shadow-sm"
            />
          </div>

          {/* Group 2: Warehouse */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="text-sm font-bold text-gray-500 shrink-0">
              เลือกคลังที่ปรับยอด:
            </div>
            <select
              value={warehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              disabled={isSubmitting || isWarehousesLoading}
              className="w-full sm:w-auto max-w-[260px] px-4 py-2.5 bg-white border border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 outline-none transition-all text-sm font-bold shadow-sm truncate"
            >
              {isWarehousesLoading ? (
                <option value="">กำลังโหลดคลัง...</option>
              ) : (
                warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
              )}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-xl shadow-emerald-900/5 space-y-6 overflow-visible animate-fade-in-up">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 w-32">ประเภท</th>
                <th className="py-3 px-3 min-w-[250px]">เวชภัณฑ์ยา</th>
                <th className="py-3 px-3 w-40">Lot Number</th>
                <th className="py-3 px-3 w-40">วันหมดอายุ</th>
                <th className="py-3 px-3 w-28 text-right">จำนวน</th>
                <th className="py-3 px-3 min-w-[200px]">เหตุผลการปรับยอด</th>
                <th className="py-3 px-3 w-16 text-center">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, index) => {
                const isAdd = row.type === 'ADD';
                return (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 text-center font-bold text-gray-400">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={row.type}
                        onChange={(e) => handleTypeChange(row.id, e.target.value as 'ADD' | 'DEDUCT')}
                        className={`w-full px-2 py-1.5 border rounded-lg font-bold outline-none text-xs
                          ${isAdd ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}
                        `}
                      >
                        <option value="ADD">➕ เพิ่มเข้า (+)</option>
                        <option value="DEDUCT">➖ ลดออก (-)</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 relative">
                      {!row.product ? (
                        <ProductSearchInput
                          warehouseId={row.type === 'DEDUCT' ? warehouseId : undefined}
                          onSelect={(p) => handleProductSelect(row.id, p, row.type)}
                          placeholder="พิมพ์ค้นหายา หรือรหัสคีย์เพื่อเริ่ม..."
                        />
                      ) : (
                        <div className="flex items-center justify-between p-2 bg-emerald-50/60 border border-emerald-100 rounded-xl text-emerald-950 shadow-inner hover:bg-emerald-50 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-sm">{row.product.generic_name}</span>
                            <span className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5 tracking-wider">
                              รหัส: {row.product.drug_code || '-'} {row.product.trade_name && `• ${row.product.trade_name}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClearProduct(row.id)}
                            className="p-1 text-emerald-500 hover:text-rose-600 hover:bg-white/80 rounded-full transition-all cursor-pointer"
                            title="ล้างข้อมูลยาในแถว"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isAdd ? (
                        <input
                          type="text"
                          value={row.lot_number}
                          onChange={(e) => updateRow(row.id, 'lot_number', e.target.value)}
                          placeholder="กรอกเลข Lot"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold uppercase"
                        />
                      ) : (
                        <select
                          value={row.lot_id || ''}
                          onChange={(e) => handleLotSelect(row.id, e.target.value)}
                          disabled={!row.product}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold"
                        >
                          <option value="">-- เลือก Lot --</option>
                          {row.available_lots?.map((l) => (
                            <option key={l.lots.id} value={l.lots.id}>
                              {l.lots.lot_number} (เหลือ {l.current_qty})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isAdd ? (
                        <DatePicker
                          value={row.expiry_date}
                          onChange={(value) => updateRow(row.id, 'expiry_date', value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                        />
                      ) : (
                        <span className="text-xs font-bold text-gray-500 px-2">
                          {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString('th-TH') : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                        placeholder="ระบุจำนวน"
                        className={`w-full text-right px-3 py-1.5 border rounded-lg font-black outline-none transition-all text-sm
                          \${isAdd ? 'border-emerald-200 focus:ring-2 focus:ring-emerald-500 text-emerald-700' : 'border-rose-200 focus:ring-2 focus:ring-rose-500 text-rose-700'}
                        `}
                      />
                      {!isAdd && row.lot_id && (
                        <div className="text-[10px] text-gray-400 font-bold mt-1 text-center">
                          สูงสุด: {row.available_lots?.find(l => l.lots.id === row.lot_id)?.current_qty || 0} {row.product?.unit_id?.name || ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) => updateRow(row.id, 'reason', e.target.value)}
                        placeholder="เช่น แก้ไขเลข Lot ผิด, ยกเลิกการรับบางรายการ, ตรวจนับพบส่วนต่าง"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบแถว"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-4 px-3 pb-2">
            <Button
              variant="outline"
              onClick={handleAddRow}
              icon={<Plus size={16} />}
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 w-full sm:w-auto border-dashed border-2"
            >
              เพิ่มรายการปรับยอด
            </Button>
          </div>
        </div>

        {/* Footer controls & Submit */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-amber-600 bg-amber-50 px-4 py-2 rounded-xl flex items-center gap-2">
            ⚠️ ข้อมูลจะถูกบันทึกเป็น Movement แบบ ADJUST ทันที พร้อมระบุเหตุผลเพื่อตรวจสอบ
          </div>
          
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการปรับยอดแมนวล'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
