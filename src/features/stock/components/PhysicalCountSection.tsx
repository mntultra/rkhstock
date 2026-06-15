import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Warehouse, StockBalance } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import { 
  ClipboardCheck, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Scale,
  MinusCircle,
  PlusCircle,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface AdjustmentRow {
  balance: StockBalance;
  physicalQty: number | '';
}

export default function PhysicalCountSection() {
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers } = useOfficers();
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // 1. กำหนดคลังเริ่มต้น
  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // 2. ดึงข้อมูลสต๊อกคงเหลือในคลังที่เลือก
  const fetchStockBalances = async (whId: string) => {
    if (!whId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_balances')
        .select(`
          id, current_qty, lots!inner(id, lot_number, expiry_date), product_id, warehouse_id,
          products ( generic_name, abbreviation, drug_code, pack_size, unit_id:unit_id(name:unit_name) )
        `)
        .eq('warehouse_id', whId)
        .order('expiry_date', { ascending: true, referencedTable: 'lots' });

      if (error) throw error;
      
      if (data) {
        const initialRows: AdjustmentRow[] = data.map((b: any) => ({
          balance: {
            ...b,
            lot_id: b.lots?.id,
            lot_number: b.lots?.lot_number,
            expiry_date: b.lots?.expiry_date
          },
          physicalQty: '' // ค่าเริ่มต้นเป็นค่าว่าง (หมายถึงยังไม่มีการแก้ไข)
        }));
        setRows(initialRows);
      }
    } catch (err) {
      console.error('Error fetching stock balances:', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลสต๊อกคงเหลือ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (warehouseId) {
      fetchStockBalances(warehouseId);
    }
  }, [warehouseId]);

  const handleWarehouseChange = (id: string) => {
    setWarehouseId(id);
    setRows([]);
  };

  // 3. ปรับปรุงค่าตัวเลขยอดตรวจนับจริง
  const handlePhysicalQtyChange = (balanceId: string, val: string) => {
    setRows(prevRows => 
      prevRows.map(r => {
        if (r.balance.id === balanceId) {
          const num = val === '' ? '' : parseInt(val);
          return {
            ...r,
            physicalQty: num === '' || isNaN(num) ? '' : Math.max(0, num)
          };
        }
        return r;
      })
    );
  };

  // 4. บันทึกยอดคลังตรวจนับจริง (Save Reconciliation)
  const handleSaveAdjustment = async () => {
    // กรองเฉพาะแถวที่มียอดแก้ไขจริง และมีค่าไม่ตรงกับระบบ
    const modifiedRows = rows.filter(r => 
      r.physicalQty !== '' && 
      Number(r.physicalQty) !== Number(r.balance.current_qty)
    );

    if (modifiedRows.length === 0) {
      alert('ไม่พบรายการสต๊อกที่มีการเปลี่ยนแปลงยอดตรวจนับจริง');
      return;
    }

    if (!confirm(`ยืนยันการบันทึกปรับยอดคลังประจำเดือน? ทั้งหมด ${modifiedRows.length} รายการ (ระบบจะสร้างประวัติความรับผิดชอบเชิงกฎหมายลงใน Audit Log อัตโนมัติ)`)) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('ไม่พบข้อมูลเซสชั่นผู้ใช้ กรุณาล็อกอินใหม่');

      const creator = officers.find(s => s.id === userId);

      // 1. สร้างหัวเอกสารปรับปรุงคลัง (Movement ADJUST Header)
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

      // 2. บันทึกประวัติรายการย่อย และ อัปเดตยอดคงเหลือจริงในแต่ละล็อต
      for (const row of modifiedRows) {
        const diff = Number(row.physicalQty) - Number(row.balance.current_qty);

        // A. แทรกรายการเคลื่อนไหวย่อยลงใน stock_movement_items
        const { error: itemError } = await supabase
          .from('stock_movement_items')
          .insert({
            movement_id: movement.id,
            product_id: row.balance.product_id,
            lot_id: row.balance.lot_id,
            qty: diff, // สามารถบันทึกเป็นบวก (ปรับเพิ่ม) หรือลบ (ปรับลด)
            pack_size: row.balance.products?.pack_size || 1,
            unit_name: row.balance.products?.unit_id?.name || ''
          });

        if (itemError) throw itemError;

        // B. ปรับยอดสต๊อกคงเหลือจริงในตารางหลัก stock_balances
        const { error: balanceUpdateError } = await supabase
          .from('stock_balances')
          .update({
            current_qty: Number(row.physicalQty)
          })
          .eq('id', row.balance.id);

        if (balanceUpdateError) throw balanceUpdateError;
      }

      setSuccessMsg(`ปรับปรุงยอดสต๊อกสำเร็จเรียบร้อย! ปรับแก้ทั้งหมด ${modifiedRows.length} ล็อตยา`);
      
      // ดึงข้อมูลสต๊อกใหม่หลังอัปเดตเสร็จ
      await fetchStockBalances(warehouseId);

    } catch (err: any) {
      console.error('Error saving stock adjustment:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกปรับยอด: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. จัดการสีวันหมดอายุ
  const getExpiryColor = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 'text-red-700 bg-red-50 border-red-200';
    if (days <= 90) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  // ค้นหากรองข้อมูลยาระหว่างแสดงผล
  const filteredRows = rows.filter(r => 
    r.balance.products?.generic_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.balance.products?.abbreviation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.balance.lot_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const modifiedCount = rows.filter(r => r.physicalQty !== '' && Number(r.physicalQty) !== Number(r.balance.current_qty)).length;

  return (
    <div className="max-w-full mx-auto space-y-6">
      
      {successMsg && (
        <Alert type="success" message={successMsg} />
      )}

      {/* Header */}
      <Card className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <ClipboardCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">ปรับยอดคลังเวชภัณฑ์ (Physical Count)</h1>
            <p className="text-gray-500 font-medium">ตรวจนับสต๊อกจริงประจำเดือนและปรับแก้ตัวเลขระบบให้ตรงความจริง</p>
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
              เลือกคลังที่ต้องการนับจริง:
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

      {/* Table & Controls */}
      <Card className="shadow-xl shadow-emerald-900/5 space-y-6 overflow-visible animate-fade-in-up">
        
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
            <input
              type="text"
              placeholder="ค้นหายา, ล็อตยาที่เปิดตรวจนับ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm text-sm"
            />
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => fetchStockBalances(warehouseId)}
              disabled={isLoading || isSubmitting}
              icon={<RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />}
              title="ดึงข้อมูลคลังใหม่"
            >
              รีเฟรช
            </Button>
            <div className="text-right">
              <span className="text-xs text-gray-400 font-extrabold block">รายการที่มีการเปลี่ยนแปลง</span>
              <span className="text-base font-extrabold text-emerald-700">
                {modifiedCount} ล็อตยา
              </span>
            </div>
          </div>
        </div>

        {/* ตารางสต๊อกตรวจนับ */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">เวชภัณฑ์ยา / รหัส</th>
                <th className="py-3.5 px-4 w-32">Lot Number</th>
                <th className="py-3.5 px-4 w-40">วันหมดอายุ</th>
                <th className="py-3.5 px-4 w-32 text-right">ยอดในระบบ (System)</th>
                <th className="py-3.5 px-4 w-40 text-center">ยอดนับจริง (Physical)</th>
                <th className="py-3.5 px-4 w-32 text-right">ส่วนต่าง (Diff)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-700 font-bold">กำลังดึงข้อมูลสต๊อกเพื่อเปิดการปรับยอด...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={32} className="text-gray-300" />
                      <p className="font-bold">ไม่พบสต๊อกเวชภัณฑ์ในคลังนี้ให้จัดทำรายการปรับยอด</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const hasDiff = row.physicalQty !== '' && Number(row.physicalQty) !== Number(row.balance.current_qty);
                  const diff = hasDiff ? Number(row.physicalQty) - Number(row.balance.current_qty) : 0;
                  
                  return (
                    <tr key={row.balance.id} className={`hover:bg-gray-50/50 transition-colors ${hasDiff ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-4 px-4 text-center font-bold text-gray-400">
                        {index + 1}
                      </td>
                      
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900">{row.balance.products?.generic_name}</div>
                        <div className="text-[11px] text-gray-400 font-bold mt-0.5">
                          รหัส: {row.balance.products?.drug_code || '-'} {row.balance.products?.abbreviation && `• ${row.balance.products?.abbreviation}`}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-mono text-xs bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-700">
                          {row.balance.lot_number}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getExpiryColor(row.balance.expiry_date)}`}>
                          {formatDate(row.balance.expiry_date)}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right font-extrabold text-gray-600 bg-gray-50/30">
                        {row.balance.current_qty}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.physicalQty}
                          onChange={(e) => handlePhysicalQtyChange(row.balance.id!, e.target.value)}
                          placeholder="ยังไม่มีการแก้ไข"
                          disabled={isSubmitting}
                          className={`w-28 text-center px-3 py-1.5 border rounded-xl font-extrabold outline-none transition-all text-sm
                            ${hasDiff 
                              ? 'border-amber-400 bg-amber-50/50 focus:ring-4 focus:ring-amber-100 text-amber-900' 
                              : 'border-emerald-100 bg-white focus:ring-4 focus:ring-emerald-50 text-emerald-800'
                            }
                          `}
                        />
                      </td>

                      <td className="py-4 px-4 text-right">
                        {hasDiff ? (
                          <div className={`flex items-center justify-end gap-1 font-black text-sm
                            ${diff > 0 ? 'text-blue-600' : 'text-rose-600'}
                          `}>
                            {diff > 0 ? (
                              <>
                                <TrendingUp size={14} />
                                <span>+{diff}</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown size={14} />
                                <span>{diff}</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 font-bold">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer controls & Submit */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-gray-500 text-center sm:text-left">
            ℹ️ ระบุยอดตรวจนับจริงเฉพาะแถวที่มีการปรับเปลี่ยนยอดจริง ยอดที่ปล่อยว่างไว้จะไม่มีการเปลี่ยนแปลง
          </div>
          
          <Button
            onClick={handleSaveAdjustment}
            disabled={isSubmitting || isLoading || modifiedCount === 0}
            icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
            size="lg"
          >
            {isSubmitting ? 'กำลังปรับยอด...' : 'บันทึกการปรับยอดคลัง'}
          </Button>
        </div>

      </Card>

    </div>
  );
}
