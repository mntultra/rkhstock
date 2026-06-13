import { supabase } from '@/lib/supabase';
import { StockBalance, ProductSearchResult } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import ProductSearchInput from '@/components/ProductSearchInput';
import { 
  Pill, 
  Trash2, 
  Plus, 
  Save, 
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowLeftRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface BorrowRow {
  id: string;
  product: ProductSearchResult | null;
  qty: number | '';
  pack_size: number;
  unit_name: string;
  previewLots: { lot_number: string, expiry_date: string, deduct_qty: number }[];
  previewError: string | null;
  totalStock: number;
  availableBalances: StockBalance[];
}

export default function BorrowForm() {
  const navigate = useNavigate();
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers, isLoading: isOfficersLoading } = useOfficers();
  
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [borrowerId, setBorrowerId] = useState<string>('');
  
  const [rows, setRows] = useState<BorrowRow[]>([
    {
      id: crypto.randomUUID(),
      product: null,
      qty: '',
      pack_size: 1,
      unit_name: '',
      previewLots: [],
      previewError: null,
      totalStock: 0,
      availableBalances: []
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. กำหนดคลังเริ่มต้น
  useEffect(() => {
    if (warehouses && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // 2. จัดการเมื่อเลือกยา
  const handleProductSelect = async (rowId: string, product: ProductSearchResult) => {
    if (!warehouseId) {
      alert('กรุณาเลือกคลัง/จุดจ่ายเวชภัณฑ์ก่อน');
      return;
    }

    try {
      // ดึงสต๊อกคงเหลือของยานี้ในคลังที่ระบุ แบบเรียงวันหมดอายุ (FEFO)
      const { data, error } = await supabase
        .from('stock_balances')
        .select('current_qty, created_at, lots!inner(lot_number, expiry_date)')
        .eq('product_id', product.id)
        .eq('warehouse_id', warehouseId)
        .gt('current_qty', 0)
        .order('expiry_date', { ascending: true, referencedTable: 'lots' })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const balances = (data || []).map((b: any) => ({
        current_qty: b.current_qty,
        created_at: b.created_at,
        lot_number: b.lots?.lot_number,
        expiry_date: b.lots?.expiry_date
      }));
      const totalStock = balances.reduce((sum, b) => sum + Number(b.current_qty), 0);

      setRows(prevRows => 
        prevRows.map(r => {
          if (r.id === rowId) {
            return {
              ...r,
              product,
              qty: '',
              pack_size: product.pack_size || 1,
              unit_name: product.unit_id?.name || '',
              totalStock,
              availableBalances: balances,
              previewLots: [],
              previewError: null
            };
          }
          return r;
        })
      );
    } catch (err: any) {
      console.error(err);
      alert('ดึงข้อมูลสต๊อกล้มเหลว: ' + err.message);
    }
  };

  // 3. จัดการกรอกจำนวนยืม
  const handleQtyChange = (rowId: string, val: string) => {
    setRows(prevRows =>
      prevRows.map(r => {
        if (r.id === rowId) {
          const num = val === '' ? '' : parseInt(val);
          const qtyVal = num === '' || isNaN(num) ? '' : Math.max(1, num);

          if (qtyVal === '') {
            return { ...r, qty: '', previewLots: [], previewError: null };
          }

          if (qtyVal > r.totalStock) {
            return {
              ...r,
              qty: qtyVal,
              previewLots: [],
              previewError: `สต็อกคลังไม่พอ (คงค้างจริง ${r.totalStock})`
            };
          }

          let remaining = qtyVal;
          const lotsToDeduct = [];
          for (const b of r.availableBalances) {
            if (remaining <= 0) break;
            const deduct = Math.min(Number(b.current_qty), remaining);
            lotsToDeduct.push({
              lot_number: b.lot_number,
              expiry_date: b.expiry_date,
              deduct_qty: deduct
            });
            remaining -= deduct;
          }

          return {
            ...r,
            qty: qtyVal,
            previewLots: lotsToDeduct,
            previewError: null
          };
        }
        return r;
      })
    );
  };

  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        product: null,
        qty: '',
        pack_size: 1,
        unit_name: '',
        previewLots: [],
        previewError: null,
        totalStock: 0,
        availableBalances: []
      }
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      setRows([{
        id: crypto.randomUUID(),
        product: null,
        qty: '',
        pack_size: 1,
        unit_name: '',
        previewLots: [],
        previewError: null,
        totalStock: 0,
        availableBalances: []
      }]);
      return;
    }
    setRows(rows.filter(r => r.id !== rowId));
  };

  const handleWarehouseChange = (newWhId: string) => {
    const hasData = rows.some(r => r.product || r.qty !== '');
    if (hasData) {
      if (!confirm('หากเปลี่ยนคลัง ข้อมูลเวชภัณฑ์ที่เลือกไว้จะถูกล้างใหม่ทั้งหมด แน่ใจหรือไม่?')) return;
    }
    setWarehouseId(newWhId);
    setRows([{
      id: crypto.randomUUID(),
      product: null,
      qty: '',
      pack_size: 1,
      unit_name: '',
      previewLots: [],
      previewError: null,
      totalStock: 0,
      availableBalances: []
    }]);
  };

  const handleSaveBorrow = async () => {
    if (!borrowerId) {
      alert('กรุณาระบุผู้ยืมเวชภัณฑ์');
      return;
    }

    const validRows = rows.filter(r => r.product && Number(r.qty) > 0);
    if (validRows.length === 0) {
      alert('กรุณากรอกข้อมูลเวชภัณฑ์และจำนวนอย่างน้อย 1 รายการ');
      return;
    }

    const hasError = rows.some(r => r.product && r.previewError);
    if (hasError) {
      alert('พบข้อผิดพลาด "สต็อกในคลังไม่เพียงพอ" กรุณาปรับจำนวนก่อนบันทึก');
      return;
    }

    if (!confirm('ยืนยันการทำรายการยืมเวชภัณฑ์?')) return;

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      const borrower = officers.find(s => s.id === borrowerId);
      const creator = officers.find(s => s.id === user.id);

      // 1. Create Stock Movement (Type: BORROW)
      const { data: movement, error: moveError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'BORROW',
          from_warehouse_id: warehouseId,
          created_by: user.id,
          created_by_position: creator?.position || null
        })
        .select('id')
        .single();

      if (moveError) throw moveError;

      // 2. Call RPC to deduct stock (dispense_with_fefo_lock)
      for (const row of validRows) {
        const { error: rpcError } = await supabase.rpc('dispense_with_fefo_lock', {
          p_movement_id: movement.id,
          p_product_id: row.product!.id,
          p_warehouse_id: warehouseId,
          p_qty: Number(row.qty)
        });
        if (rpcError) throw rpcError;

        // 2.5 Update stock_movement_items to add snapshot data
        await supabase
          .from('stock_movement_items')
          .update({
            pack_size: row.pack_size,
            unit_name: row.unit_name
          })
          .eq('movement_id', movement.id)
          .eq('product_id', row.product!.id);

        // 3. Insert into borrowings table
        const { error: borrowError } = await supabase
          .from('borrowings')
          .insert({
            product_id: row.product!.id,
            borrower_id: borrowerId,
            borrower_position: borrower?.position || null,
            warehouse_id: warehouseId,
            borrowed_qty: Number(row.qty),
            pack_size: row.pack_size,
            unit_name: row.unit_name,
            status: 'PENDING',
            movement_id: movement.id
          });
        
        if (borrowError) throw borrowError;
      }

      setSuccessMsg('บันทึกการยืมเวชภัณฑ์สำเร็จ');
      
      // Reset form
      setBorrowerId('');
      setRows([{
        id: crypto.randomUUID(),
        product: null,
        qty: '',
        pack_size: 1,
        unit_name: '',
        previewLots: [],
        previewError: null,
        totalStock: 0,
        availableBalances: []
      }]);
      
      // กลับไปหน้า Dashboard หลังจากสำเร็จนิดนึง
      setTimeout(() => {
        navigate('/borrow');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/20 text-white">
          <ArrowLeftRight size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">ทำรายการยืมเวชภัณฑ์</h1>
          <p className="text-gray-500 font-medium text-sm mt-0.5">ระบุคลังที่ให้ยืมและเจ้าหน้าที่ผู้ขอยืม</p>
        </div>
      </div>

      {successMsg && (
        <Alert type="success" message={successMsg} />
      )}

      {/* Header Form */}
      <Card>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <label className="block text-sm font-bold text-gray-700">ผู้ขอยืม (Borrower)</label>
          <select
            value={borrowerId}
            onChange={(e) => setBorrowerId(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 outline-none transition-all text-sm font-bold shadow-sm"
          >
            <option value="">-- เลือกเจ้าหน้าที่ --</option>
            {isOfficersLoading ? (
              <option value="">กำลังโหลด...</option>
            ) : (
              officers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)
            )}
          </select>
        </div>
        
        <div className="w-full md:w-1/2 space-y-2">
          <label className="block text-sm font-bold text-gray-700">คลังที่ให้ยืม (From Warehouse)</label>
          <select
            value={warehouseId}
            onChange={(e) => handleWarehouseChange(e.target.value)}
            disabled={isSubmitting || isWarehousesLoading}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 outline-none transition-all text-sm font-bold shadow-sm"
          >
            {isWarehousesLoading ? (
              <option value="">กำลังโหลดคลัง...</option>
            ) : (
              warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
            )}
          </select>
        </div>
      </Card>

      {/* Items Table */}
      <Card noPadding>
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center rounded-t-3xl">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Pill size={18} /> รายการเวชภัณฑ์ที่ต้องการยืม
          </h2>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
            ระบบจะหักสต๊อกแบบ FEFO อัตโนมัติ
          </span>
        </div>

        <div className="p-4 space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50/50 p-3 rounded-2xl border border-gray-100 transition-all hover:border-gray-300">
              <div className="w-8 shrink-0 flex justify-center text-gray-400 font-bold text-sm">
                {index + 1}
              </div>
              
              <div className="flex-1 w-full relative">
                {row.product ? (
                  <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-emerald-200 shadow-sm">
                    <div>
                      <p className="font-bold text-emerald-900 leading-none">{row.product.generic_name}</p>
                      {row.product.trade_name && <p className="text-xs text-gray-500 mt-1">{row.product.trade_name}</p>}
                    </div>
                    <button 
                      onClick={() => {
                        const newRows = [...rows];
                        newRows[index] = { ...row, product: null, qty: '', pack_size: 1, unit_name: '', previewLots: [], previewError: null, totalStock: 0, availableBalances: [] };
                        setRows(newRows);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="เปลี่ยนยา"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                ) : (
                  <ProductSearchInput 
                    onSelect={(p) => handleProductSelect(row.id, p)}
                    placeholder="พิมพ์ชื่อเวชภัณฑ์ หรือ รหัสเวชภัณฑ์..."
                  />
                )}
              </div>

              <div className="w-full md:w-48 shrink-0 relative">
                <input
                  type="number"
                  min="1"
                  placeholder="จำนวนยืม"
                  value={row.qty}
                  onChange={(e) => handleQtyChange(row.id, e.target.value)}
                  disabled={!row.product}
                  className={`w-full px-4 py-3 bg-white border ${row.previewError ? 'border-red-400 ring-4 ring-red-50' : 'border-gray-200 focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500'} rounded-xl outline-none transition-all font-bold text-center`}
                />
                {row.product && (
                  <div className="absolute -top-2 -right-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    สต๊อก: {row.totalStock}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRemoveRow(row.id)}
                className="p-3 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors shrink-0"
                title="ลบรายการนี้"
              >
                <Trash2 size={20} />
              </button>

              {/* Error & FEFO Preview */}
              {(row.previewError || row.previewLots.length > 0) && (
                <div className="w-full basis-full mt-2 pl-11 pr-14">
                  {row.previewError && (
                    <div className="text-red-500 text-xs font-bold flex items-center gap-1 mb-1">
                      <AlertTriangle size={14} /> {row.previewError}
                    </div>
                  )}
                  {row.previewLots.length > 0 && !row.previewError && (
                    <div className="bg-emerald-50/50 rounded-lg p-2 border border-emerald-100/50">
                      <p className="text-[10px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                        <CheckCircle size={12} /> เตรียมหักล็อต:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.previewLots.map((pl, idx) => (
                          <span key={idx} className="bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                            Lot: {pl.lot_number} ({pl.deduct_qty})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleAddRow}
            icon={<Plus size={20} />}
            className="mt-2 py-4 border-2 border-dashed"
          >
            เพิ่มรายการยืม
          </Button>
        </div>
      </Card>

      <div className="flex justify-end pt-4 pb-12">
        <Button
          onClick={handleSaveBorrow}
          disabled={isSubmitting}
          variant="warning"
          size="lg"
          icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
        >
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการยืมเวชภัณฑ์'}
        </Button>
      </div>

    </div>
  );
}
