import { useState, useEffect, useRef, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { StockBalance, ProductSearchResult } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import ProductSearchInput from '@/components/ProductSearchInput';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Pill, 
  Trash2, 
  Plus, 
  Save, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Activity, 
  FileText, 
  X,
  Volume2,
  Sparkles,
  Trash,
  ChevronDown,
  Search,
  History
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';

// ─── Custom Officer Dropdown ─────────────────────────────────────────────────────
function CustomOfficerSelect({ value, onChange, officers, placeholder = '-- เลือกเจ้าหน้าที่ --' }: {
  value: string; onChange: (v: string) => void; officers: any[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = officers.find(s => s.id === value);
  const filtered = officers.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.position && s.position.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(!open); setSearch(''); }}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border ${
          open ? 'border-rose-500 ring-4 ring-rose-50 shadow-md' : 'border-gray-200 hover:border-rose-300'
        } rounded-xl text-left transition-all outline-none duration-200`}>
        <div className="flex flex-col min-w-0 pr-2">
          {selected ? (
            <><span className="font-extrabold text-gray-900 text-sm leading-tight truncate">{selected.full_name}</span>
            <span className="text-[11px] font-semibold text-rose-600 truncate mt-0.5">{selected.position || '-'}</span></>
          ) : <span className="text-sm font-bold text-gray-400 italic">{placeholder}</span>}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-rose-500' : ''} shrink-0`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Search size={14} className="text-rose-500 ml-2 shrink-0" />
            <input type="text" placeholder="ค้นหาชื่อ หรือตำแหน่ง..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none py-1 text-gray-700 placeholder-gray-400 font-bold" autoFocus />
          </div>
          <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {filtered.length > 0 ? filtered.map(s => (
              <button key={s.id} type="button" onClick={() => { onChange(s.id); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 hover:bg-rose-50 transition-colors flex flex-col ${
                  value === s.id ? 'bg-rose-50/70 border-l-4 border-rose-500' : ''}`}>
                <span className="text-xs font-black text-gray-900">{s.full_name}</span>
                <span className="text-[10px] text-gray-500 font-semibold mt-0.5">{s.position || '-'}</span>
              </button>
            )) : <div className="px-4 py-3 text-center text-xs text-gray-400 font-bold">ไม่พบรายชื่อ</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Lot Dropdown ─────────────────────────────────────────────────────────
function CustomLotSelect({ value, onChange, options, hasError, unitName }: {
  value: string; onChange: (v: string) => void; options: any[]; hasError?: boolean;
  unitName: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const activeLots = options.filter(o => o.current_qty > 0);
  const totalStock = activeLots.reduce((sum, o) => sum + o.current_qty, 0);
  const selected = options.find(o => o.lot_number === value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (activeLots.length <= 1) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); setHighlightedIndex(0); }
      else { setHighlightedIndex(prev => (prev < activeLots.length - 1 ? prev + 1 : prev)); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < activeLots.length) {
        onChange(activeLots[highlightedIndex].lot_number);
      }
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  const hasMultipleLots = activeLots.length > 1;

  return (
    <div ref={ref} className="relative w-full">
      <button 
        type="button" 
        onKeyDown={handleKeyDown}
        onClick={() => { 
          if (hasMultipleLots) {
            setOpen(!open); 
            setHighlightedIndex(activeLots.findIndex(o => o.lot_number === value) || 0); 
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-3 lg:py-2.5 bg-white border ${
          hasError ? 'border-red-400 bg-red-50 focus:ring-red-100 focus:border-red-500' :
          open ? 'border-rose-500 ring-4 ring-rose-50 shadow-md' : 'border-rose-200 hover:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:border-rose-500'
        } ${!hasMultipleLots ? 'bg-gray-50/50 border-gray-200 cursor-default hover:border-gray-200' : ''} rounded-xl text-left transition-all outline-none duration-200 shadow-sm`}
      >
        <div className="flex flex-col min-w-0 pr-2">
          {selected ? (
            <>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-extrabold text-gray-900 text-sm leading-tight truncate">{selected.lot_number}</span>
                {hasMultipleLots && (
                  <span className="flex-shrink-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black" title={`มีทั้งหมด ${activeLots.length} ล็อต`}>
                    {activeLots.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-rose-600 truncate mt-0.5">เหลือ: {selected.current_qty} (รวม {totalStock})</span>
            </>
          ) : <span className="text-sm font-bold text-gray-400 italic">-- เลือกล็อต --</span>}
        </div>
        {hasMultipleLots && (
          <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-rose-500' : ''} shrink-0`} />
        )}
      </button>
      
      {open && (
        <div className="absolute z-[60] w-[calc(100vw-3rem)] sm:w-auto sm:min-w-[320px] -left-4 sm:left-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden max-h-72 flex flex-col">
          {activeLots.length > 0 && (
            <div className="grid grid-cols-[minmax(90px,1fr)_70px_90px] gap-3 px-4 py-2 bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
              <div>Lot no.</div>
              <div className="text-right">คงเหลือ</div>
              <div className="text-right">Exp.</div>
            </div>
          )}
          <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {activeLots.length > 0 ? activeLots.map((lot, idx) => {
              const isNearExpiry = lot.expiry_date && (new Date(lot.expiry_date).getTime() - new Date().getTime()) < (6 * 30 * 24 * 60 * 60 * 1000);
              return (
                <button 
                  key={idx} 
                  type="button" 
                  onClick={() => { onChange(lot.lot_number); setOpen(false); }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-4 py-2.5 transition-colors grid grid-cols-[minmax(90px,1fr)_70px_90px] gap-3 items-center ${
                    highlightedIndex === idx ? 'bg-rose-50/70 border-l-4 border-rose-500' : 'hover:bg-gray-50 border-l-4 border-transparent'
                  } ${value === lot.lot_number ? 'bg-rose-50 border-rose-500' : ''}`}
                >
                  <span className="text-sm font-black text-gray-900 truncate" title={lot.lot_number}>{lot.lot_number}</span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50/50 px-1.5 py-0.5 rounded text-right">{lot.current_qty}</span>
                  <span className={`text-[11px] font-semibold text-right ${isNearExpiry ? 'text-amber-600 bg-amber-50 px-1 rounded' : 'text-gray-500'}`}>
                    {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('en-GB') : '-'}
                  </span>
                </button>
              );
            }) : <div className="px-4 py-3 text-center text-xs text-gray-400 font-bold">ไม่พบข้อมูลล็อต</div>}
          </div>
          <div className="p-3 bg-rose-50/40 border-t border-rose-100 text-xs font-bold text-rose-800 flex items-center justify-between">
            <span>รวมทุกล็อต:</span>
            <span>{totalStock} {unitName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const navigate = useNavigate();
  const preFillData = location.state as { productId?: string; lotNumber?: string } | null;
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers } = useOfficers();
  const [warehouseId, setWarehouseId] = useState<string>(''); // คลังควบคุมจ่าย
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // --- Header States ---
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [actorId, setActorId] = useState('');
  const [headerNote, setHeaderNote] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

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

  // 1.0 ดึงข้อมูล default ผู้จ่ายเวชภัณฑ์ คลังย่อย
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const { data } = await supabase.from('default_officers').select('*');
        if (!data) return;
        const find = (key: string) => data.find((o: any) => o.role_key === key)?.user_id || '';
        const issuer = find('issuer_sub_warehouse'); // ผู้จ่าย
        if (issuer) setActorId(issuer);
      } catch (e) { console.error(e); }
    };
    loadDefaults();
  }, []);

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
    const isDuplicate = rows.some(r => r.product?.id === product.id && r.id !== rowId);
    if (isDuplicate) {
      if (!window.confirm(`มีการเลือกเวชภัณฑ์ ${product.generic_name} ในรายการอื่นแล้ว คุณต้องการเพิ่มรายการซ้ำหรือไม่?`)) {
        setEditingRowId(null);
        return;
      }
    }

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
    setEditingRowId(null);
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
          return { ...r, qty: qtyVal as number | '', previewError: false };
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

  const handleAutoSplitRow = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !row.product || !row.qty) return;
    const qtyToAllocate = Number(row.qty);
    
    // Sort available balances in FEFO (already sorted by expiry date in availableBalances)
    const lots = row.availableBalances;
    let remainingQty = qtyToAllocate;
    const newRows: DisposalRow[] = [];
    
    for (const lot of lots) {
      if (remainingQty <= 0) break;
      const allocQty = Math.min(lot.current_qty, remainingQty);
      if (allocQty > 0) {
        newRows.push({
          id: crypto.randomUUID(),
          product: row.product,
          qty: allocQty,
          pack_size: row.pack_size,
          unit_name: row.unit_name,
          selected_lot: lot.lot_number,
          reason: row.reason,
          totalStock: row.totalStock,
          availableBalances: row.availableBalances,
        });
        remainingQty -= allocQty;
      }
    }
    
    if (remainingQty > 0 && newRows.length > 0) {
      newRows[newRows.length - 1].qty = Number(newRows[newRows.length - 1].qty) + remainingQty;
    }
    
    setRows(prevRows => {
      const idx = prevRows.findIndex(r => r.id === rowId);
      if (idx === -1) return prevRows;
      const updated = [...prevRows];
      updated.splice(idx, 1, ...newRows);
      return updated;
    });
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

  const handleSaveIssue = async () => {
    let hasError = false;
    const finalRows: DisposalRow[] = [];
    const virtualStock = new Map<string, number>();
    const virtualTotalStock = new Map<string, number>();

    for (const r of rows) {
      if (r.product && r.availableBalances) {
        if (!virtualTotalStock.has(r.product.id)) {
           virtualTotalStock.set(r.product.id, r.totalStock);
           for (const lot of r.availableBalances) {
             virtualStock.set(`${r.product.id}_${lot.lot_number}`, lot.current_qty);
           }
        }
      }
    }

    const validRows = rows.filter(r => r.product && Number(r.qty) > 0);

    if (validRows.length === 0) {
      alert('กรุณากรอกข้อมูลเวชภัณฑ์ยาและจำนวนอย่างถูกต้องอย่างน้อย 1 รายการ');
      return;
    }
    if (!actorId) { alert('กรุณาระบุ ผู้จ่ายเวชภัณฑ์ ในข้อมูลส่วนหัว'); return; }

    for (const r of validRows) {
      const pid = r.product!.id;
      const lotNum = r.selected_lot;
      let requestedQty = Number(r.qty);

      let currentTotal = virtualTotalStock.get(pid) || 0;
      if (requestedQty > currentTotal) {
         hasError = true;
         break;
      }
      virtualTotalStock.set(pid, currentTotal - requestedQty);

      let currentLotQty = virtualStock.get(`${pid}_${lotNum}`) || 0;
      
      if (requestedQty <= currentLotQty) {
        virtualStock.set(`${pid}_${lotNum}`, currentLotQty - requestedQty);
        finalRows.push(r);
      } else {
        if (currentLotQty > 0) {
          finalRows.push({
            ...r,
            id: crypto.randomUUID(),
            qty: currentLotQty,
          });
          requestedQty -= currentLotQty;
          virtualStock.set(`${pid}_${lotNum}`, 0);
        }
        
        for (const lot of r.availableBalances) {
          if (requestedQty <= 0) break;
          let availLotQty = virtualStock.get(`${pid}_${lot.lot_number}`) || 0;
          if (availLotQty > 0) {
            const allocQty = Math.min(availLotQty, requestedQty);
            finalRows.push({
              ...r,
              id: crypto.randomUUID(),
              qty: allocQty,
              selected_lot: lot.lot_number,
            });
            requestedQty -= allocQty;
            virtualStock.set(`${pid}_${lot.lot_number}`, availLotQty - allocQty);
          }
        }
        
        if (requestedQty > 0) {
           hasError = true;
           break;
        }
      }
    }
    
    if (hasError) {
      alert('พบข้อผิดพลาด "สต็อกในคลังไม่เพียงพอ" มีการเบิกรายการซ้ำจนสต็อกรวมหมด หรือระบุจำนวนที่เกินจริง กรุณาตรวจสอบจำนวนตัดอีกครั้ง');
      return;
    }

    if (!confirm(`ยืนยันการบันทึกเอกสารตัดจำหน่ายเวชภัณฑ์? ทั้งหมด ${finalRows.length} รายการ`)) {
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
          doc_date: docDate,
          from_warehouse_id: warehouseId,
          created_by: userId,
          created_by_position: creator?.position || null,
          note: headerNote || null
        })
        .select('id')
        .single();

      if (moveError) throw moveError;

      const finalInvoiceList: DisposalResultItem[] = [];

      // B. ตัดสต๊อกตามที่เลือก
      for (const row of finalRows) {
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
          <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
            <Trash size={28} />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">จัดการ/ทำลายยาหมดอายุ (Expired & Disposal)</h1>
            </div>
            <p className="text-gray-500 font-medium mt-1">บันทึกตัดเวชภัณฑ์ออกจากระบบเนื่องจากหมดอายุ, เสื่อมสภาพ, หรือบริจาคออก</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button variant="outline" onClick={() => navigate('/reports/movements?type=DISPOSE')} icon={<History size={18} />}>
            ประวัติการทำลาย
          </Button>
        </div>
      </div>

      <Card className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-fade-in-up border-rose-100">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">เลขที่เอกสาร</label>
          <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 font-mono flex items-center justify-between">
            <span>DIS{docDate.replace(/-/g, '')}-XX</span>
            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Auto</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">วันที่ทำลาย <span className="text-red-500">*</span></label>
          <DatePicker value={docDate} onChange={setDocDate} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 outline-none transition-all text-sm font-medium" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">คลังต้นทาง <span className="text-red-500">*</span></label>
          <select value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)} disabled={isSubmitting || isWarehousesLoading} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 outline-none transition-all text-sm font-medium">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">ผู้จ่ายเวชภัณฑ์ <span className="text-red-500">*</span></label>
          <CustomOfficerSelect value={actorId} onChange={setActorId} officers={officers} placeholder="-- เลือกผู้จ่ายเวชภัณฑ์ --" />
        </div>
        <div className="md:col-span-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">หมายเหตุเอกสาร</label>
          <input type="text" value={headerNote} onChange={e => setHeaderNote(e.target.value)} placeholder="เช่น ทำลายยาหมดอายุประจำเดือน หรือส่งบริจาคมูลนิธิ" className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 outline-none transition-all text-sm font-medium" />
        </div>
      </Card>

      {/* ตารางแสดงผลรายการ Inline */}
      <Card className="overflow-visible animate-fade-in-up">
        <h3 className="text-sm font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-2">
          <Activity size={16} /> รายการจัดการ/ทำลายยาหมดอายุ
        </h3>

        <div className="min-h-[250px] overflow-visible pb-10 lg:pb-16">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-[3rem_minmax(200px,1fr)_120px_220px_180px_4rem] xl:grid-cols-[3rem_minmax(250px,1fr)_120px_240px_180px_4rem] gap-2 px-4 py-3 border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
            <div className="text-center">#</div>
            <div>ค้นหาและระบุรายการเวชภัณฑ์</div>
            <div className="text-right pr-4">จำนวนตัด</div>
            <div className="text-center">ล็อต (Lot)</div>
            <div className="text-center">สาเหตุ</div>
            <div className="text-center">จัดการ</div>
          </div>

          <div className="flex flex-col gap-4 lg:gap-0 lg:divide-y lg:divide-gray-50 pt-4 lg:pt-0 overflow-visible">
            {rows.map((row, index) => {
              const showSplitWarning = row.product && row.qty && row.selected_lot && (() => {
                const lot = row.availableBalances.find(b => b.lot_number === row.selected_lot);
                return lot && Number(row.qty) > lot.current_qty && Number(row.qty) <= row.totalStock;
              })();

              return (
                <Fragment key={row.id}>
                  <div className="relative group overflow-visible lg:grid lg:grid-cols-[3rem_minmax(200px,1fr)_120px_220px_180px_4rem] xl:grid-cols-[3rem_minmax(250px,1fr)_120px_240px_180px_4rem] lg:gap-2 items-center bg-white rounded-3xl shadow-sm border border-gray-100 lg:border-none lg:shadow-none lg:rounded-none p-4 lg:p-0 hover:bg-gray-50/30 transition-colors" style={{ zIndex: 40 - index }}>
                  
                  {/* Mobile Card Header */}
                  <div className="flex lg:hidden justify-between items-center mb-3 pb-3 border-b border-gray-50">
                    <span className="font-extrabold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg text-xs">รายการที่ {index + 1}</span>
                    <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>

                  {/* Desktop Index */}
                  <div className="hidden lg:block py-4 px-4 text-center font-bold text-gray-400">{index + 1}</div>

                  {/* Product Search */}
                  <div className="py-2 lg:py-4 lg:px-4 relative overflow-visible">
                    <label className="block lg:hidden text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mb-1.5">1. ค้นหาเวชภัณฑ์</label>
                    {!row.product || editingRowId === row.id ? (
                      <div className="relative z-50 flex gap-2 items-center">
                        <div className="flex-1 min-w-0">
                          <ProductSearchInput
                            warehouseId={warehouseId}
                            onSelect={(product) => handleProductSelect(row.id, product)}
                            placeholder="พิมพ์ค้นหายา หรือรหัสคีย์เพื่อเริ่ม..."
                            className="w-full text-base lg:text-sm py-3 lg:py-2.5"
                            autoFocus={editingRowId === row.id}
                          />
                        </div>
                        {editingRowId === row.id && row.product && (
                          <button type="button" onClick={() => setEditingRowId(null)} className="p-2 text-gray-400 hover:text-gray-600">
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div 
                          onClick={() => setEditingRowId(row.id)}
                          className="flex-1 flex items-center justify-between p-3 lg:p-2.5 bg-rose-50/60 hover:bg-rose-100/60 border border-rose-100 hover:border-rose-300 rounded-xl text-rose-900 shadow-inner cursor-pointer transition-all group/item min-w-0"
                          title="คลิกเพื่อเปลี่ยนเวชภัณฑ์"
                        >
                          <div className="flex flex-col gap-1 w-full min-w-0">
                            <span className="font-extrabold text-base lg:text-sm text-gray-900 truncate">
                              {row.product.generic_name}
                              {row.product.abbreviation && <span className="text-gray-500 font-medium text-xs ml-1.5">({row.product.abbreviation})</span>}
                            </span>
                            <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                              <span className="text-[10px] bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded font-mono font-bold uppercase">{row.product.drug_code || '-'}</span>
                              {row.product.is_high_alert && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold animate-pulse">High Alert</span>}
                              {row.product.is_psycho_narco && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Psycho</span>}
                            </div>
                          </div>
                          <div className="p-1.5 text-rose-400 group-hover/item:text-rose-600 group-hover/item:bg-white rounded-full transition-all shrink-0 hidden lg:block"><Search size={16} /></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:contents mt-2 lg:mt-0">
                    {/* Qty & Unit */}
                    <div className="py-2 lg:py-4 lg:px-4 text-left lg:text-right flex flex-col justify-end">
                      <label className="block lg:hidden text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mb-1.5">2. จำนวนตัด</label>
                      <div className="flex items-center gap-1.5 lg:justify-end">
                        <input
                          type="number" min="1" placeholder="0"
                          value={row.qty} onChange={(e) => handleQtyChange(row.id, e.target.value)}
                          disabled={!row.product || isSubmitting}
                          className={`w-full lg:w-20 px-3 py-3 lg:py-2.5 bg-white/70 backdrop-blur-sm border rounded-xl outline-none transition-all text-base lg:text-sm font-extrabold text-center shadow-sm
                            ${!row.product ? 'border-gray-100 text-gray-300' : row.previewError ? 'border-red-400 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-100' : 'border-rose-200 text-rose-800 focus:ring-4 focus:ring-rose-100 focus:border-rose-500'}
                          `}
                        />
                        {row.product && (
                          <span className="font-bold text-slate-500 text-sm whitespace-nowrap ml-1 shrink-0">
                            {row.pack_size && row.pack_size !== 1 ? `x ${row.pack_size} ` : ''}{row.unit_name || 'ชิ้น'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lot */}
                    <div className="py-2 lg:py-4 lg:px-4 font-medium text-gray-700 text-center relative overflow-visible flex flex-col justify-end">
                      <label className="block lg:hidden text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mb-1.5 text-left">3. เลือกล็อต</label>
                      {!row.product ? (
                        <span className="text-gray-300 font-bold text-xs italic hidden lg:block text-center py-3 lg:py-0">-</span>
                      ) : (
                        <div className="relative overflow-visible">
                          <CustomLotSelect
                            value={row.selected_lot}
                            onChange={(val) => handleLotChange(row.id, val)}
                            options={row.availableBalances}
                            hasError={row.previewError}
                            unitName={row.unit_name || 'ชิ้น'}
                          />
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div className="py-2 lg:py-4 lg:px-4 font-medium text-gray-700 text-center relative overflow-visible flex flex-col justify-end col-span-2 lg:col-span-1">
                      <label className="block lg:hidden text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mb-1.5">4. สาเหตุ</label>
                      <select
                        value={row.reason}
                        onChange={(e) => handleReasonChange(row.id, e.target.value)}
                        disabled={!row.product || isSubmitting}
                        className="w-full text-base lg:text-sm px-3 py-3 lg:py-2.5 border rounded-xl font-bold outline-none transition-all border-rose-200 bg-white text-rose-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 shadow-sm"
                      >
                        <option value="EXPIRED">หมดอายุ (Expired)</option>
                        <option value="DAMAGED">ชำรุด/เสื่อมสภาพ (Damaged)</option>
                        <option value="DONATED">บริจาคออก (Donated)</option>
                      </select>
                    </div>

                    {/* Desktop Remove Button */}
                    <div className="hidden lg:flex py-4 px-4 items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={isSubmitting}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        title="ลบแถวรายการ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Warning Row (Split Warning) */}
                {showSplitWarning && (
                  <div className="lg:table-row bg-amber-50/40 rounded-b-3xl lg:rounded-none -mt-4 lg:mt-0 pt-6 lg:pt-0 pb-2 px-4 lg:px-0">
                    <div className="lg:table-cell col-span-7 py-2.5 lg:px-4 lg:border-b lg:border-gray-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-amber-800 font-bold bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 shadow-sm gap-3">
                        <div className="flex items-start sm:items-center gap-2">
                          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5 sm:mt-0 animate-bounce" />
                          <span className="leading-relaxed">ล็อต {row.selected_lot} มีสต๊อกไม่พอจ่าย (มี {row.availableBalances.find(b => b.lot_number === row.selected_lot)?.current_qty} ยอดสั่ง {row.qty}) แต่ยอดรวมคงคลังทุกล็อตมีเพียงพอ ({row.totalStock} {row.unit_name})</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleAutoSplitRow(row.id)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer shadow whitespace-nowrap"
                        >
                          แยกล็อตอัตโนมัติ (Auto-Split)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            )})}
          </div>
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
