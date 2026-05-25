import React, { useReducer, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase'; // ปรับ Path ให้ตรงกับโปรเจกต์
import { v4 as uuidv4 } from 'uuid'; // สมมติว่ามีไลบรารีนี้ หรือใช้ crypto.randomUUID()

// ==========================================
// 1. Types & Reducer
// ==========================================
type DispenseItem = {
  id: string; // Local ID สำหรับ UI
  product_id: string;
  product_name: string;
  qty: number;
  lots: { out_lot_number: string; out_expiry_date: string; out_qty_dispensed: number }[];
  isVoided: boolean;
};

type State = {
  movement_id: string | null;
  items: DispenseItem[];
};

type Action =
  | { type: 'SET_MOVEMENT_ID'; payload: string }
  | { type: 'ADD_ITEM'; payload: DispenseItem }
  | { type: 'VOID_ITEM'; payload: string };

function dispenseReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MOVEMENT_ID':
      return { ...state, movement_id: action.payload };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'VOID_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload ? { ...item, isVoided: true } : item
        ),
      };
    default:
      return state;
  }
}

// ==========================================
// 2. Main Component
// ==========================================
export default function DispenseForm() {
  const [state, dispatch] = useReducer(dispenseReducer, { movement_id: null, items: [] });
  const [warehouseId, setWarehouseId] = useState<string>(''); // ต้องถูกเลือกก่อนเริ่มตัดจ่าย
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Draft Row State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [inputQty, setInputQty] = useState<number | ''>('');
  
  // Preview State
  const [availableBalances, setAvailableBalances] = useState<any[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLots, setPreviewLots] = useState<any[]>([]);
  
  const [isDispensing, setIsDispensing] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  // ดึงข้อมูลคลังจริงจาก Supabase
  useEffect(() => {
    const fetchWarehouses = async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (data && data.length > 0) {
        setWarehouses(data);
        setWarehouseId(data[0].id); // Default = คลังแรก
      }
    };
    fetchWarehouses();
  }, []);


  // Fuzzy Search ยา
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('id, generic_name')
        .ilike('generic_name', `%${searchQuery}%`)
        .eq('is_active', true)
        .limit(10);
      setSearchResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // เมื่อเลือกยาให้ดึงยอดคงเหลือเพื่อเตรียมโชว์ FEFO Preview
  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setSearchQuery(product.generic_name);
    setSearchResults([]);
    setInputQty('');

    const { data } = await supabase
      .from('stock_balances')
      .select('lot_number, expiry_date, current_qty')
      .eq('product_id', product.id)
      .eq('warehouse_id', warehouseId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false }); // FEFO
    
    setAvailableBalances(data || []);
    setTimeout(() => {
        document.getElementById('qty-input')?.focus();
    }, 100);
  };

  // คำนวณ Preview Lots ทุกครั้งที่พิมพ์ตัวเลข Qty
  useEffect(() => {
    if (!selectedProduct) return;
    const qty = Number(inputQty);
    if (qty <= 0) {
      setPreviewLots([]);
      setPreviewError(null);
      return;
    }

    const totalStock = availableBalances.reduce((sum, b) => sum + Number(b.current_qty), 0);
    if (qty > totalStock) {
      setPreviewError(`สต็อกไม่พอ (มีอยู่ ${totalStock} หน่วย)`);
      setPreviewLots([]);
      return;
    }

    setPreviewError(null);
    let remaining = qty;
    const lotsToDeduct = [];
    
    for (let b of availableBalances) {
      if (remaining <= 0) break;
      const deduct = Math.min(Number(b.current_qty), remaining);
      lotsToDeduct.push({ lot_number: b.lot_number, expiry_date: b.expiry_date, deduct_qty: deduct });
      remaining -= deduct;
    }
    setPreviewLots(lotsToDeduct);

  }, [inputQty, availableBalances, selectedProduct]);

  // ==========================================
  // 3. Action Handlers (Enter & Void)
  // ==========================================
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (!selectedProduct) return;
      const qty = Number(inputQty);
      if (qty <= 0 || previewError) return; // ถ้า Error ห้ามตัด

      setIsDispensing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // 1. สร้างหัวเอกสาร (Movement) ถ้ายังไม่มี
        let currentMovementId = state.movement_id;
        if (!currentMovementId) {
          const { data: moveData, error: moveError } = await supabase
            .from('stock_movements')
            .insert({
              movement_type: 'DISPENSE',
              from_warehouse_id: warehouseId,
              created_by: userId
            })
            .select('id')
            .single();
            
          if (moveError) throw moveError;
          currentMovementId = moveData.id;
          dispatch({ type: 'SET_MOVEMENT_ID', payload: moveData.id });
        }

        // 2. เรียกใช้ RPC ตัดสต๊อกแบบมี Lock (FEFO)
        const { data: rpcData, error: rpcError } = await supabase.rpc('dispense_with_fefo_lock', {
          p_movement_id: currentMovementId,
          p_product_id: selectedProduct.id,
          p_warehouse_id: warehouseId,
          p_qty: qty,
          p_user_id: userId
        });

        if (rpcError) throw rpcError;

        // 3. ย้ายข้อมูลเข้า State (Completed)
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            id: crypto.randomUUID(),
            product_id: selectedProduct.id,
            product_name: selectedProduct.generic_name,
            qty: qty,
            lots: rpcData || [], // [ { out_lot_number, out_qty_dispensed } ]
            isVoided: false
          }
        });

        // 4. ล้างค่า Draft Row เพื่อให้รับของชิ้นต่อไปทันที
        setSelectedProduct(null);
        setSearchQuery('');
        setInputQty('');
        setPreviewLots([]);
        
        // Focus กลับไปที่ช่องค้นหายา
        productInputRef.current?.focus();

      } catch (err: any) {
        console.error("Dispense Error:", err);
        alert(err.message === 'INSUFFICIENT_STOCK' ? 'สต๊อกไม่พอ ณ ตอนประมวลผล!' : 'เกิดข้อผิดพลาดในการจ่ายยา');
      } finally {
        setIsDispensing(false);
      }
    }
  };

  const handleVoidItem = async (item: DispenseItem) => {
    if (!state.movement_id) return;
    if (!confirm('ยืนยันการยกเลิกรายการนี้? (ระบบจะคืนสต๊อกอัตโนมัติ)')) return;

    try {
      // Soft Delete: อัปเดต deleted_at ซึ่งจะสั่งให้ Trigger ใน DB ทำงานคืนสต๊อกให้ทันที
      const { error } = await supabase
        .from('stock_movement_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('movement_id', state.movement_id)
        .eq('product_id', item.product_id);
        
      if (error) throw error;

      dispatch({ type: 'VOID_ITEM', payload: item.id });
    } catch (err) {
      console.error("Void Error:", err);
      alert('ไม่สามารถยกเลิกรายการได้');
    }
  };

  // ==========================================
  // 4. UI Rendering
  // ==========================================
  const activeItems = state.items.filter(i => !i.isVoided);
  const runningTotalQty = activeItems.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow font-sans">
      
      {/* Header Info */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Dispense (ตัดจ่ายยา)</h1>
        <div className="text-right">
          <p className="text-sm text-gray-500">คลังจ่าย</p>
          <select 
            value={warehouseId} 
            onChange={e => setWarehouseId(e.target.value)}
            disabled={!!state.movement_id} // ล็อกเมื่อเริ่มจ่ายแล้ว
            className="border-gray-300 rounded text-sm bg-gray-50 font-bold"
          >
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* Completed Items Table */}
      <div className="mb-8">
        <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3 w-10 text-center">#</th>
              <th className="p-3">รายการยา</th>
              <th className="p-3 text-right">จำนวน</th>
              <th className="p-3">Lot ที่ถูกตัด (FEFO)</th>
              <th className="p-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {state.items.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">ยังไม่มีรายการ</td></tr>
            ) : (
              state.items.map((item, index) => (
                <tr key={item.id} className={`border-t ${item.isVoided ? 'bg-red-50 opacity-60' : 'bg-white'}`}>
                  <td className="p-3 text-center">{index + 1}</td>
                  <td className={`p-3 font-medium ${item.isVoided && 'line-through text-red-600'}`}>{item.product_name}</td>
                  <td className={`p-3 text-right font-bold ${item.isVoided && 'line-through'}`}>{item.qty}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {item.lots.map((l, i) => (
                      <div key={i}>Lot: {l.out_lot_number || '-'} ({l.out_qty_dispensed})</div>
                    ))}
                  </td>
                  <td className="p-3 text-center">
                    {!item.isVoided && (
                      <button 
                        onClick={() => handleVoidItem(item)}
                        className="text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition"
                      >
                        Void
                      </button>
                    )}
                    {item.isVoided && <span className="text-xs font-bold text-red-600">VOIDED</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-bold border-t">
            <tr>
              <td colSpan={2} className="p-3 text-right">รวมจำนวนจ่ายทั้งสิ้น (Running Total):</td>
              <td className="p-3 text-right text-lg text-blue-600">{runningTotalQty}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Draft Row Input Area */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wider">สแกน / ค้นหายาที่ต้องการจ่าย</h3>
        
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 relative">
            <input
              ref={productInputRef}
              type="text"
              placeholder="พิมพ์ชื่อยา หรือ ยิง Barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={isDispensing}
              className="w-full p-3 border-gray-300 rounded shadow-sm focus:ring-blue-500 font-medium"
            />
            {searchResults.length > 0 && !selectedProduct && (
              <ul className="absolute z-10 w-full bg-white border mt-1 shadow-xl max-h-60 overflow-auto rounded">
                {searchResults.map(p => (
                  <li 
                    key={p.id} 
                    onClick={() => handleSelectProduct(p)}
                    className="p-3 hover:bg-blue-100 cursor-pointer border-b last:border-b-0 font-medium text-gray-800"
                  >
                    {p.generic_name}
                  </li>
                ))}
              </ul>
            )}
            
            {/* Show Selected Product Badge */}
            {selectedProduct && (
              <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                {selectedProduct.generic_name}
                <button onClick={() => { setSelectedProduct(null); setSearchQuery(''); setPreviewLots([]); setPreviewError(null); }} className="hover:text-red-200">✕</button>
              </div>
            )}
          </div>

          <div className="col-span-4 relative">
            <input
              id="qty-input"
              type="number"
              placeholder="จำนวน"
              value={inputQty}
              onChange={e => setInputQty(Number(e.target.value) || '')}
              onKeyDown={handleKeyDown}
              disabled={!selectedProduct || isDispensing}
              className={`w-full p-3 rounded shadow-sm font-bold text-xl text-center focus:ring-2 outline-none
                ${previewError ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500'}
              `}
            />
            <div className="text-center mt-1 text-xs text-gray-500">กด <kbd className="bg-gray-200 px-1 rounded">Enter</kbd> เพื่อจ่าย</div>
          </div>
        </div>

        {/* Live Preview FEFO Area */}
        {selectedProduct && (
          <div className="mt-4 bg-white p-3 rounded border">
            {previewError ? (
              <div className="text-red-600 font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {previewError}
              </div>
            ) : previewLots.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Lot ที่เตรียมถูกตัด (FEFO Preview):</p>
                <div className="flex flex-wrap gap-2">
                  {previewLots.map((lot, idx) => (
                    <span key={idx} className="bg-green-100 border border-green-300 text-green-800 text-xs px-2 py-1 rounded-md">
                      Lot: {lot.lot_number || '-'} (ตัด {lot.deduct_qty})
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">กรอกจำนวนเพื่อดู Lot ที่จะถูกตัด</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
