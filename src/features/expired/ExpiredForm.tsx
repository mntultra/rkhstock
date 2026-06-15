import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { StockBalance, ProductSearchResult } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import ProductSearchInput from '@/components/ProductSearchInput';
import { useLocation } from 'react-router-dom';
import { 
  Pill, 
  Trash2, 
  Plus, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Activity, 
  FileText, 
  X,
  Volume2,
  Sparkles,
  Trash
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface DisposalRow {
  id: string; // คีย์ชั่วคราวบนหน้า UI
  product: ProductSearchResult | null; // เวชภัณฑ์ที่เลือกในแถว
  qty: number | ''; // จำนวนที่ต้องการจ่าย
  pack_size: number;
  unit_name: string;
  selected_lot: string; // ล็อตที่ผู้ใช้เลือก
  reason: string; // สาเหตุการจำหน่าย (EXPIRED, DONATED, DAMAGED)
  totalStock: number; // ยอดคงเหลือรวมในคลังสินค้า
  availableBalances: StockBalance[]; // ล็อตเวชภัณฑ์ที่เหลืออยู่จริงในคลังนั้นๆ
  previewError?: boolean; // ข้อผิดพลาดเมื่อป้อนข้อมูลไม่ถูกต้อง
}

interface DisposalResultItem {
  generic_name: string;
  qty: number;
  reason: string;
  lots: { lot_number: string; qty: number }[];
}

export default function ExpiredForm() {
  const location = useLocation();
  const preFillData = location.state as { productId?: string; lotNumber?: string } | null;
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers } = useOfficers();
  const [warehouseId, setWarehouseId] = useState<string>(''); // คลังควบคุมจ่าย
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // ตารางแถวป้อนข้อมูลเริ่มต้นด้วย 1 แถวว่างเปล่า
  const [rows, setRows] = useState<DisposalRow[]>([
    {
      id: crypto.randomUUID(),
      product: null,
      qty: '',
      pack_size: 1,
      unit_name: '',
      selected_lot: '',
      reason: 'EXPIRED',
      totalStock: 0,
      availableBalances: []
    }
  ]);

  // สรุปรายการ
  const [invoiceResults, setInvoiceResults] = useState<DisposalResultItem[] | null>(null);

  // 1. กำหนดคลังเริ่มต้นเมื่อโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // 1.1 จัดการโหลดข้อมูลเวชภัณฑ์ที่ถูกส่งมาจากศูนย์การแจ้งเตือน (Pre-fill)
  useEffect(() => {
    const loadPreFilledProduct = async () => {
      if (preFillData?.productId && warehouseId) {
        try {
          // ดึงรายละเอียดตัวเวชภัณฑ์พร้อมหน่วยนับ
          const { data: product, error } = await supabase
            .from('products')
            .select(`
              *,
              unit_id:unit_id(name:unit_name),
              master_dosage_forms(name_en, abbreviation)
            `)
            .eq('id', preFillData.productId)
            .maybeSingle();

          if (error) throw error;
          if (product) {
            const stockData = await fetchProductStock(product.id, warehouseId);
            const sumStock = stockData.reduce((sum, item) => sum + Number(item.current_qty), 0);

            // ตรวจสอบล็อตเป้าหมาย
            let targetLot = '';
            if (preFillData.lotNumber) {
              const lotExists = stockData.some(item => item.lot_number === preFillData.lotNumber);
              if (lotExists) {
                targetLot = preFillData.lotNumber;
              } else if (stockData.length > 0) {
                targetLot = stockData[0].lot_number;
              }
            } else if (stockData.length > 0) {
              targetLot = stockData[0].lot_number;
            }

            setRows([
              {
                id: crypto.randomUUID(),
                product: product as unknown as ProductSearchResult,
                qty: '',
                pack_size: product.pack_size || 1,
                unit_name: product.unit_id?.name || '',
                selected_lot: targetLot,
                reason: 'EXPIRED',
                totalStock: sumStock,
                availableBalances: stockData
              }
            ]);
          }
        } catch (err) {
          console.error('Failed to load prefilled product:', err);
        }
      }
    };
    loadPreFilledProduct();
  }, [preFillData, warehouseId]);

  // เล่นเสียงบี๊บคู่ฉลองการจ่ายสำเร็จ (Confirm Beep) แบบไร้ไฟล์มีเดีย
  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1250, audioCtx.currentTime + 0.08); // เล่นสองโน้ตคู่ประสาน
      
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch (e) {
      console.error('Audio beep failed:', e);
    }
  };

  // 2. ดึงข้อมูลสต๊อกคงเหลือจริงในแต่ละล็อตเพื่อเตรียมคำนวณ FEFO ล่วงหน้า
  const fetchProductStock = async (productId: string, whId: string) => {
    const { data } = await supabase
      .from('stock_balances')
      .select('current_qty, lots!inner(id, lot_number, expiry_date)')
      .eq('product_id', productId)
      .eq('warehouse_id', whId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false, referencedTable: 'lots' });
      
    return (data || []).map((b: any) => ({
      current_qty: b.current_qty,
      lot_id: b.lots?.id,
      lot_number: b.lots?.lot_number,
      expiry_date: b.lots?.expiry_date
    }));
  };

  // 3. เมื่อคัดเลือกเวชภัณฑ์บนบรรทัด
  const handleProductSelect = async (rowId: string, product: ProductSearchResult) => {
    const stockData = await fetchProductStock(product.id, warehouseId);
    const sumStock = stockData.reduce((sum, item) => sum + Number(item.current_qty), 0);

    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          const updatedRow = {
            ...r,
            product,
            totalStock: sumStock,
            availableBalances: stockData,
            qty: '' as const, // รีเซ็ตจำนวนป้อน
            pack_size: product.pack_size || 1,
            unit_name: product.unit_id?.name || '',
            selected_lot: stockData.length > 0 ? stockData[0].lot_number : '',
            reason: 'EXPIRED'
          };
          return updatedRow;
        }
        return r;
      })
    );
  };

  // 4. ล้างข้อมูลเวชภัณฑ์บนแถว
  const handleClearProduct = (rowId: string) => {
    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          return {
            ...r,
            product: null,
            qty: '' as const,
            pack_size: 1,
            unit_name: '',
            selected_lot: '',
            reason: 'EXPIRED',
            totalStock: 0,
            availableBalances: []
          };
        }
        return r;
      })
    );
  };

  // 5. ปรับเปลี่ยนจำนวนการจ่าย
  const handleQtyChange = (rowId: string, val: string) => {
    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          const num = val === '' ? '' : parseInt(val);
          const qtyVal = num === '' || isNaN(num) ? '' : Math.max(1, num);
          return { ...r, qty: qtyVal };
        }
        return r;
      })
    );
  };

  const handleReasonChange = (rowId: string, reason: string) => {
    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          return { ...r, reason };
        }
        return r;
      })
    );
  };

  const handleLotChange = (rowId: string, lotNumber: string) => {
    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          // Check if selected lot is not the oldest
          if (r.availableBalances.length > 0) {
            const oldestLot = r.availableBalances[0];
            if (oldestLot.lot_number !== lotNumber) {
              const confirmMsg = `แจ้งเตือน: มีเวชภัณฑ์ล็อตที่หมดอายุก่อน (Lot: ${oldestLot.lot_number}) คุณแน่ใจหรือไม่ว่าต้องการตัดจำหน่ายล็อต ${lotNumber}?`;
              if (!window.confirm(confirmMsg)) {
                return r; // Cancel change
              }
            }
          }
          return { ...r, selected_lot: lotNumber };
        }
        return r;
      })
    );
  };

  // 6. เพิ่มและลบแถวตารางแบบ Inline
  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        product: null,
        qty: '',
        pack_size: 1,
        unit_name: '',
        selected_lot: '',
        reason: 'EXPIRED',
        totalStock: 0,
        availableBalances: []
      }
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      // ถ้าเหลือแถวสุดท้าย ให้กดลบเป็นการเคลียร์ข้อมูลในแถวแทนการลบ
      setRows([
        {
          id: crypto.randomUUID(),
          product: null,
          qty: '',
          pack_size: 1,
          unit_name: '',
          selected_lot: '',
          reason: 'EXPIRED',
          totalStock: 0,
          availableBalances: []
        }
      ]);
      return;
    }
    setRows(rows.filter(r => r.id !== rowId));
  };

  // 7. จัดการเปลี่ยนคลังควบคุมจ่าย
  const handleWarehouseChange = (newWhId: string) => {
    const hasData = rows.some(r => r.product || r.qty !== '');
    if (hasData) {
      if (!confirm('หากทำการเปลี่ยนคลังควบคุมจ่าย ข้อมูลเวชภัณฑ์และจำนวนในตารางที่ระบุไว้จะถูกล้างใหม่ทั้งหมด คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนคลัง?')) {
        return;
      }
    }
    setWarehouseId(newWhId);
    // ล้างข้อมูลสต๊อกทั้งหมดบนตาราง
    setRows([
      {
        id: crypto.randomUUID(),
        product: null,
        qty: '',
        pack_size: 1,
        unit_name: '',
        selected_lot: '',
        reason: 'EXPIRED',
        totalStock: 0,
        availableBalances: []
      }
    ]);
  };

  // 8. สั่งบันทึกเอกสารตัดจ่ายแบบเรียงล็อตสุทธิ (Save Issue Voucher Transaction)
  const handleSaveIssue = async () => {
    // กรองเฉพาะบรรทัดที่กรอกข้อมูลเวชภัณฑ์สมบูรณ์
    const validRows = rows.filter(r => r.product && Number(r.qty) > 0);

    if (validRows.length === 0) {
      alert('กรุณากรอกข้อมูลเวชภัณฑ์ยาและจำนวนอย่างถูกต้องอย่างน้อย 1 รายการ');
      return;
    }

    // ตรวจสอบยอดคงเหลือของ Lot ที่เลือก
    const hasError = rows.some(r => {
      if (!r.product || !r.selected_lot || !r.qty) return false;
      const lotData = r.availableBalances.find(b => b.lot_number === r.selected_lot);
      if (!lotData) return true;
      return Number(r.qty) > Number(lotData.current_qty);
    });
    
    if (hasError) {
      alert('พบข้อผิดพลาด "สต็อกในคลังไม่เพียงพอสำหรับล็อตที่เลือก" กรุณาตรวจสอบจำนวนจ่ายอีกครั้ง');
      return;
    }

    if (!confirm(`ยืนยันการบันทึกเอกสารตัดจำหน่ายเวชภัณฑ์? ทั้งหมด ${validRows.length} รายการ`)) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');
    setInvoiceResults(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error('ไม่พบข้อมูลเซสชั่นผู้ใช้ กรุณาล็อกอินใหม่');

      const creator = officers.find(s => s.id === userId);

      // A. สร้างหัวบิลสั่งตัดจำหน่าย (DISPOSE)
      const { data: movement, error: moveError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'DISPOSE',
          from_warehouse_id: warehouseId,
          created_by: userId,
          created_by_position: creator?.position || null
        })
        .select('id')
        .single();

      if (moveError) throw moveError;

      const finalInvoiceList: DisposalResultItem[] = [];

      // B. ตัดสต๊อกตามที่เลือก
      for (const row of validRows) {
        const lotData = row.availableBalances.find(b => b.lot_number === row.selected_lot)!;
        
        // 1. Insert into stock_movement_items
        const { error: itemError } = await supabase
          .from('stock_movement_items')
          .insert({
            movement_id: movement.id,
            product_id: row.product!.id,
            lot_id: lotData.lot_id,
            qty: -Number(row.qty),
            pack_size: row.pack_size,
            unit_name: row.unit_name,
            remark: row.reason // เก็บสาเหตุไว้ใน remark
          });
          
        if (itemError) throw itemError;
        
        // 2. Execute RPC to safely deduct from stock_balances
        const { error: deductError } = await supabase.rpc('deduct_stock_balance', {
          p_product_id: row.product!.id,
          p_warehouse_id: warehouseId,
          p_lot_number: lotData.lot_number,
          p_expiry_date: lotData.expiry_date || null,
          p_qty: Number(row.qty)
        });
        
        if (deductError) {
          throw new Error(`ไม่สามารถหักยอดสต็อก ${row.product!.generic_name} Lot ${lotData.lot_number} ได้: ${deductError.message}`);
        }

        finalInvoiceList.push({
          generic_name: row.product!.generic_name,
          qty: Number(row.qty),
          reason: row.reason,
          lots: [{
            lot_number: lotData.lot_number,
            qty: Number(row.qty)
          }]
        });
      }

      playSuccessBeep();
      setSuccessMsg('บันทึกใบตัดจำหน่ายสต๊อกเรียบร้อยแล้ว!');
      setInvoiceResults(finalInvoiceList);

      // เคลียร์ตารางใหม่เพื่อเริ่มต้นการสั่งจ่ายรอบถัดไป
      setRows([
        {
          id: crypto.randomUUID(),
          product: null,
          qty: '',
          pack_size: 1,
          unit_name: '',
          selected_lot: '',
          reason: 'EXPIRED',
          totalStock: 0,
          availableBalances: []
        }
      ]);

    } catch (err: any) {
      console.error('Error saving disposal transaction:', err);
      alert('เกิดข้อผิดพลาดในการตัดจำหน่ายสต๊อก: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // สรุปยอดจำนวนจ่ายทั้งหมด
  const activeRows = rows.filter(r => r.product && Number(r.qty) > 0);
  const totalItemsCount = activeRows.length;
  const runningTotalQty = activeRows.reduce((sum, r) => sum + Number(r.qty), 0);

  return (
    <div className="max-w-full mx-auto space-y-6">
      
      {/* ระบบ Alert สำเร็จ */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-up">
          <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={24} />
          <span className="font-extrabold">{successMsg}</span>
        </div>
      )}

      {/* Header และการเลือกคลัง */}
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Trash size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">จัดการ/ทำลายยาหมดอายุ (Expired & Disposal)</h1>
            <p className="text-gray-500 font-medium">บันทึกตัดเวชภัณฑ์ออกจากระบบเนื่องจากหมดอายุ, เสื่อมสภาพ, หรือบริจาคออก</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 self-start md:self-auto w-full sm:w-auto">
          <div className="text-sm font-bold text-gray-500 sm:text-right w-full sm:w-auto flex items-center gap-1">
            <Volume2 size={16} className="text-emerald-600" /> คลังสินค้าต้นทาง:
          </div>
          <select
            value={warehouseId}
            onChange={(e) => handleWarehouseChange(e.target.value)}
            disabled={isSubmitting || isWarehousesLoading}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm font-bold shadow-sm"
          >
            {isWarehousesLoading ? (
              <option value="">กำลังโหลดคลัง...</option>
            ) : (
              warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
            )}
          </select>
        </div>
      </div>

      {/* ตารางแสดงผลรายการ Inline */}
      <Card className="overflow-visible animate-fade-in-up">
        <h3 className="text-sm font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-2">
          <Activity size={16} /> รายการจัดการ/ทำลายยาหมดอายุ
        </h3>

        <div className="overflow-visible min-h-[250px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[320px]">ค้นหาและระบุรายการเวชภัณฑ์</th>
                <th className="py-3.5 px-4 w-40 text-center">ล็อต (Lot)</th>
                <th className="py-3.5 px-4 w-40 text-center">สาเหตุ</th>
                <th className="py-3.5 px-4 w-32 text-center">จำนวนตัด</th>
                <th className="py-3.5 px-4 w-16 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="py-4 px-4 text-center font-bold text-gray-400 group-hover:text-emerald-600 transition-colors">
                    {index + 1}
                  </td>

                  {/* คอลัมน์ค้นหายา */}
                  <td className="py-4 px-4 relative overflow-visible">
                    {!row.product ? (
                      <ProductSearchInput
                        warehouseId={warehouseId}
                        onSelect={(product) => handleProductSelect(row.id, product)}
                        placeholder="พิมพ์ค้นหายา หรือรหัสคีย์เพื่อเริ่ม..."
                        className="w-full text-sm"
                      />
                    ) : (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl text-emerald-900 shadow-inner group-hover:bg-emerald-50 transition-colors">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm">{row.product.generic_name}</span>
                          <span className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5 tracking-wider">
                            รหัส: {row.product.drug_code || '-'} {row.product.abbreviation && `• ${row.product.abbreviation}`}
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

                  {/* คอลัมน์ระบุจำนวน */}
                  <td className="py-4 px-4 text-center">
                    <input
                      type="number"
                      min="1"
                      placeholder="ป้อนจำนวน"
                      value={row.qty}
                      onChange={(e) => handleQtyChange(row.id, e.target.value)}
                      disabled={!row.product || isSubmitting}
                      className={`w-full text-center px-4 py-2.5 border rounded-xl font-black text-lg outline-none transition-all
                        ${!row.product 
                          ? 'bg-gray-50 border-gray-100 text-gray-300' 
                          : row.previewError
                            ? 'border-red-300 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-100'
                            : 'border-emerald-100 bg-white text-emerald-900 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500'
                        }
                      `}
                    />
                  </td>

                  {/* คอลัมน์เลือก Lot */}
                  <td className="py-4 px-4 font-medium text-gray-700 text-center">
                    {!row.product ? (
                      <span className="text-gray-300 font-bold text-xs italic">-</span>
                    ) : (
                      <select
                        value={row.selected_lot}
                        onChange={(e) => handleLotChange(row.id, e.target.value)}
                        className="w-full text-sm px-3 py-2.5 border rounded-xl font-bold outline-none transition-all border-emerald-100 bg-white text-emerald-900 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
                      >
                        {row.availableBalances.map((lot, idx) => (
                          <option key={idx} value={lot.lot_number}>
                            {lot.lot_number} (เหลือ: {lot.current_qty})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* คอลัมน์ลบแถว */}
                  <td className="py-4 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={isSubmitting}
                      className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      title="ลบแถวรายการ"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* แถบควบคุมและแสดงผลด้านล่างตาราง */}
        <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddRow}
            disabled={isSubmitting}
            icon={<Plus size={18} />}
          >
            เพิ่มบรรทัดรายการเวชภัณฑ์
          </Button>

          {/* สรุปข้อมูลสดด้านท้าย */}
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">จำนวนเวชภัณฑ์ที่จำหน่าย</span>
              <span className="text-base font-extrabold text-rose-800">{totalItemsCount} รายการ</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">รวมจำนวนหักลดคลัง</span>
              <span className="text-base font-extrabold text-rose-800">{runningTotalQty} หน่วย</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ปุ่มบันทึกเอกสารใหญ่ */}
      <div className="flex justify-end pt-4">
        <Button
          type="button"
          onClick={handleSaveIssue}
          disabled={isSubmitting || totalItemsCount === 0}
          icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
          size="lg"
          className="bg-rose-600 hover:bg-rose-700"
        >
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกตัดจำหน่าย'}
        </Button>
      </div>

      {/* ==================================================== */}
      {/* 📦 กล่องข้อความสรุปผลการตัดล็อตยาสำเร็จ (Invoice Result Modal) */}
      {/* ==================================================== */}
      {invoiceResults && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer" onClick={() => setInvoiceResults(null)}></div>
          
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-emerald-950 to-neutral-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl z-10 animate-fade-in-up max-h-[85vh] overflow-y-auto">
            
            <button
              onClick={() => setInvoiceResults(null)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-400/20 flex items-center justify-center border border-rose-400/30">
                <FileText className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2">
                  <span>บันทึกใบตัดจำหน่ายสำเร็จ!</span>
                  <Sparkles size={16} className="text-rose-400 animate-pulse" />
                </h3>
                <p className="text-xs text-rose-400">ใบเสร็จการตัดจำหน่ายเวชภัณฑ์ (Disposal Summary)</p>
              </div>
            </div>

            {/* รายละเอียด */}
            <div className="space-y-4 text-sm font-medium">
              <p className="text-emerald-300/80">ระบบได้ดำเนินการเบิกสินค้าออกจากคลังย่อยเพื่อจำหน่ายทิ้ง/บริจาคเรียบร้อยแล้ว:</p>

              <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/10 text-emerald-300 font-extrabold border-b border-white/5">
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">เวชภัณฑ์</th>
                      <th className="p-3 text-center">สาเหตุ</th>
                      <th className="p-3 text-right">จำนวนตัด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoiceResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-white">{item.generic_name}</td>
                        <td className="p-3 text-center font-bold text-rose-400 bg-rose-500/5">{item.reason === 'EXPIRED' ? 'หมดอายุ' : item.reason === 'DONATED' ? 'บริจาค' : 'เสื่อมสภาพ'}</td>
                        <td className="p-3 text-right text-sm font-black text-rose-400">{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-emerald-400/5 border border-emerald-400/10 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed text-emerald-300/90 mt-4">
                <AlertCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong>การยืนยันประวัติ (Ledger Log Verification):</strong> รายการจ่ายสต๊อกทั้งหมดในใบนี้ได้ถูกส่งลงบันทึกในตารางประวัติธุรกรรมสต๊อก (`stock_movements`) และตรวจสอบความรับผิดชอบเชิงกฎหมาย (Immutable Audit Logs) เรียบร้อยแล้ว ไม่สามารถแก้ไขข้อมูลย้อนหลังแบบไร้บันทึกได้ครับ
                </span>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button 
                onClick={() => setInvoiceResults(null)}
              >
                เสร็จสิ้นการยืนยัน
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
