import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { supabase } from '@/lib/supabase';
import { StockBalance, ProductSearchResult } from '@/types';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOfficers } from '@/hooks/useOfficers';
import { useNavigate } from 'react-router-dom';
import ProductSearchInput from '@/components/ProductSearchInput';
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
  Sparkles,
  ChevronDown,
  Search,
  Camera,
  History,
  Printer,
  Ban,
  Keyboard,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import DispenseRelationalImportModal from './DispenseRelationalImportModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { useDispenseDraft, formatDraftTimestamp, DispenseDraftPayload, DraftRecord } from '@/hooks/useDispenseDraft';

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
          open ? 'border-emerald-500 ring-4 ring-emerald-50 shadow-md' : 'border-gray-200 hover:border-emerald-300'
        } rounded-xl text-left transition-all outline-none duration-200`}>
        <div className="flex flex-col min-w-0 pr-2">
          {selected ? (
            <><span className="font-extrabold text-gray-900 text-sm leading-tight truncate">{selected.full_name}</span>
            <span className="text-[11px] font-semibold text-emerald-600 truncate mt-0.5">{selected.position || '-'}</span></>
          ) : <span className="text-sm font-bold text-gray-400 italic">{placeholder}</span>}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-emerald-500' : ''} shrink-0`} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden max-h-64 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Search size={14} className="text-emerald-500 ml-2 shrink-0" />
            <input type="text" placeholder="ค้นหาชื่อ หรือตำแหน่ง..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none py-1 text-gray-700 placeholder-gray-400 font-bold" autoFocus />
          </div>
          <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {filtered.length > 0 ? filtered.map(s => (
              <button key={s.id} type="button" onClick={() => { onChange(s.id); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex flex-col ${
                  value === s.id ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : ''}`}>
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
function CustomLotSelect({ value, onChange, options, hasError, setCellRef, onKeyDown, unitName }: {
  value: string; onChange: (v: string) => void; options: StockBalance[]; hasError?: boolean;
  setCellRef: (el: HTMLButtonElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
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
    if (activeLots.length <= 1) {
      onKeyDown(e);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (!open) {
        setOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev < activeLots.length - 1 ? prev + 1 : prev));
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (open) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
      }
      return;
    }
    if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        if (highlightedIndex >= 0 && highlightedIndex < activeLots.length) {
          onChange(activeLots[highlightedIndex].lot_number);
        }
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'Tab' && open) {
      setOpen(false);
    }
    onKeyDown(e);
  };

  const hasMultipleLots = activeLots.length > 1;

  return (
    <div ref={ref} className="relative w-full">
      <button 
        type="button" 
        ref={setCellRef}
        onKeyDown={handleKeyDown}
        onClick={() => { 
          if (hasMultipleLots) {
            setOpen(!open); 
            setHighlightedIndex(activeLots.findIndex(o => o.lot_number === value) || 0); 
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white border ${
          hasError ? 'border-red-400 bg-red-50 focus:ring-red-100 focus:border-red-500' :
          open ? 'border-emerald-500 ring-4 ring-emerald-50 shadow-md' : 'border-emerald-200 hover:border-emerald-300 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500'
        } ${!hasMultipleLots ? 'bg-gray-50/50 border-gray-200 cursor-default hover:border-gray-200' : ''} rounded-xl text-left transition-all outline-none duration-200`}
      >
        <div className="flex flex-col min-w-0 pr-2">
          {selected ? (
            <>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-extrabold text-gray-900 text-sm leading-tight truncate">{selected.lot_number}</span>
                {hasMultipleLots && (
                  <span className="flex-shrink-0 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-black" title={`มีทั้งหมด ${activeLots.length} ล็อต`}>
                    {activeLots.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 truncate mt-0.5">เหลือสต๊อก: {selected.current_qty} (รวม {totalStock} {unitName})</span>
            </>
          ) : <span className="text-sm font-bold text-gray-400 italic">-- เลือกล็อต --</span>}
        </div>
        {hasMultipleLots && (
          <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-emerald-500' : ''} shrink-0`} />
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
                    highlightedIndex === idx ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : 'hover:bg-gray-50 border-l-4 border-transparent'
                  } ${value === lot.lot_number ? 'bg-emerald-50 border-emerald-500' : ''}`}
                >
                  <span className="text-sm font-black text-gray-900 truncate" title={lot.lot_number}>{lot.lot_number}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded text-right">{lot.current_qty}</span>
                  <span className={`text-[11px] font-semibold text-right ${isNearExpiry ? 'text-amber-600 bg-amber-50 px-1 rounded' : 'text-gray-500'}`}>
                    {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('en-GB') : '-'}
                  </span>
                </button>
              );
            }) : <div className="px-4 py-3 text-center text-xs text-gray-400 font-bold">ไม่พบข้อมูลล็อต</div>}
          </div>
          <div className="p-3 bg-emerald-50/40 border-t border-emerald-100 text-xs font-bold text-emerald-800 flex items-center justify-between">
            <span>ยอดรวมทุกแหล่งล็อต:</span>
            <span>{totalStock} {unitName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface DispenseRow {
  id: string;
  product: ProductSearchResult | null;
  qty: number | '';
  pack_size: number;
  unit_name: string;
  selected_lot: string;
  totalStock: number;
  availableBalances: StockBalance[];
  previewError?: boolean;
  remark?: string;
}

interface DispenseResultItem {
  generic_name: string;
  qty: number;
  lots: { lot_number: string; qty: number }[];
}

// ─── Keyboard Navigation ──────────────────────────────────────────────────
const COLUMNS = ['qty', 'selected_lot', 'remark'] as const;
type NavColumn = typeof COLUMNS[number];

export default function DispenseForm() {
  const navigate = useNavigate();
  const { warehouses, isLoading: isWarehousesLoading } = useWarehouses();
  const { officers } = useOfficers(true);
  const [warehouseId, setWarehouseId] = useState<string>(''); // คลังต้นทางที่จ่าย
  const [toWarehouseId, setToWarehouseId] = useState<string>(''); // คลังปลายทางที่รับ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // --- Current user ---
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id ?? null));
  }, []);

  // --- Header States ---
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [actorId, setActorId] = useState(''); // ผู้จ่ายเวชภัณฑ์ (คลังย่อย)
  const [headerNote, setHeaderNote] = useState(''); // หมายเหตุ
  const [dispenseDocId, setDispenseDocId] = useState<string | null>(null);

  // Scanner States
  const [activeScanRowId, setActiveScanRowId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'PRODUCT' | 'LOT' | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const initialId = useRef(crypto.randomUUID());
  const [rows, setRows] = useState<DispenseRow[]>(() => [
    { id: initialId.current, product: null, qty: '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }
  ]);
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const [editingRowId, setEditingRowId] = useState<string | null>(() => initialId.current);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [invoiceResults, setInvoiceResults] = useState<DispenseResultItem[] | null>(null);

  // ─── Draft (IndexedDB auto-save) ─────────────────────────────────────────
  const { scheduleSave, loadDraft, clearDraft } = useDispenseDraft({
    userId: currentUserId,
  });

  // Draft restore banner state
  const [pendingDraft, setPendingDraft] = useState<{ savedAt: string; payload: DispenseDraftPayload } | null>(null);
  // Use a ref (not state) to prevent re-render race conditions on first mount
  const draftCheckedRef = useRef(false);

  // Check for existing draft once user ID is available — runs only once
  useEffect(() => {
    if (!currentUserId) return;
    if (draftCheckedRef.current) return; // already ran
    draftCheckedRef.current = true;
    loadDraft().then((record: DraftRecord | null) => {
      if (record) {
        console.debug('[Draft] Found draft, showing banner:', record.savedAt);
        setPendingDraft({ savedAt: record.savedAt, payload: record.payload });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]); // intentionally only re-run when userId changes

  // Auto-save on every meaningful state change (debounced inside hook)
  useEffect(() => {
    if (!currentUserId) return;
    // Only auto-save if there is at least one row with a product selected
    const hasData = rows.some(r => r.product !== null);
    if (!hasData) return;
    const payload: DispenseDraftPayload = {
      warehouseId, toWarehouseId, actorId, docDate, headerNote,
      rows: rows.map(r => ({
        id: r.id,
        productId: r.product?.id,
        productName: r.product?.generic_name,
        tradeName: r.product?.trade_name,
        drugCode: r.product?.drug_code,
        isHighAlert: r.product?.is_high_alert,
        isPsychoNarco: r.product?.is_psycho_narco,
        qty: r.qty,
        pack_size: r.pack_size,
        unit_name: r.unit_name,
        selected_lot: r.selected_lot,
        remark: r.remark,
        totalStock: r.totalStock,
        availableBalances: r.availableBalances,
      })),
    };
    scheduleSave(payload);
  }, [rows, warehouseId, toWarehouseId, actorId, docDate, headerNote, currentUserId, scheduleSave]);

  // Restore handler — called when user clicks "ใช่ กู้คืน"
  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    const p = pendingDraft.payload;
    if (p.warehouseId) setWarehouseId(p.warehouseId);
    if (p.toWarehouseId) setToWarehouseId(p.toWarehouseId);
    if (p.actorId) setActorId(p.actorId);
    if (p.docDate) setDocDate(p.docDate);
    if (p.headerNote) setHeaderNote(p.headerNote);
    if (Array.isArray(p.rows) && p.rows.length > 0) {
      setRows((p.rows as any[]).map((r: any) => ({
        id: r.id || crypto.randomUUID(),
        product: r.productId ? {
          id: r.productId,
          generic_name: r.productName || '',
          trade_name: r.tradeName || '',
          drug_code: r.drugCode || '',
          is_high_alert: r.isHighAlert || false,
          is_psycho_narco: r.isPsychoNarco || false,
          pack_size: r.pack_size || 1,
          unit_id: r.unit_name ? { name: r.unit_name } : null,
        } : null,
        qty: r.qty ?? '',
        pack_size: r.pack_size || 1,
        unit_name: r.unit_name || '',
        selected_lot: r.selected_lot || '',
        remark: r.remark || '',
        totalStock: r.totalStock || 0,
        availableBalances: r.availableBalances || [],
        previewError: false,
      })));
    }
    setPendingDraft(null);
  };

  // Discard draft — user clicks "ไม่ใช่ เริ่มใหม่"
  const handleDiscardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  // Default Warehouses: From "คลังย่อย" to "จุดจ่าย"
  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      if (!warehouseId) {
        const sub = warehouses.find(w => /ย่อย|sub/i.test(w.name)) || warehouses[warehouses.length - 1];
        setWarehouseId(sub?.id || warehouses[0].id);
      }
      if (!toWarehouseId) {
        const dispensePoint = warehouses.find(w => /จุดจ่าย/i.test(w.name)) || warehouses[0];
        setToWarehouseId(dispensePoint?.id || warehouses[0].id);
      }
    }
  }, [warehouses]);

  // Default officers
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const { data } = await supabase.from('default_officers').select('*');
        if (!data) return;
        const find = (key: string) => data.find((o: any) => o.role_key === key)?.user_id || '';
        const dispenser = find('dispenser_sub_warehouse'); // ผู้จ่าย
        if (dispenser) setActorId(dispenser);
      } catch (e) { console.error(e); }
    };
    loadDefaults();
  }, []);

// ─── Keyboard Navigation ──────────────────────────────────────────────────
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const refCallbacks = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());

  const setCellRef = useCallback((rowId: string, col: NavColumn) => {
    const key = `${rowId}-${col}`;
    if (!refCallbacks.current.has(key)) {
      refCallbacks.current.set(key, (el: HTMLElement | null) => {
        if (el) cellRefs.current.set(key, el);
        else cellRefs.current.delete(key);
      });
    }
    return refCallbacks.current.get(key)!;
  }, []);

  const focusCell = useCallback((rowId: string, col: NavColumn) => {
    const el = cellRefs.current.get(`${rowId}-${col}`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement && el.type !== 'date') el.select();
    }
  }, []);

  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>,
    rowId: string,
    col: NavColumn
  ) => {
    const colIndex = COLUMNS.indexOf(col);
    const currentRows = rowsRef.current;
    
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (colIndex < COLUMNS.length - 1) focusCell(rowId, COLUMNS[colIndex + 1]);
      else {
        const idx = currentRows.findIndex(i => i.id === rowId);
        if (idx < currentRows.length - 1) {
          setEditingRowId(currentRows[idx + 1].id);
        } else {
          const newId = crypto.randomUUID();
          setRows(prev => [...prev, { id: newId, product: null, qty: '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }]);
          setEditingRowId(newId);
        }
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (colIndex > 0) focusCell(rowId, COLUMNS[colIndex - 1]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex < COLUMNS.length - 1) focusCell(rowId, COLUMNS[colIndex + 1]);
      else {
        const idx = currentRows.findIndex(i => i.id === rowId);
        if (idx < currentRows.length - 1) {
          setEditingRowId(currentRows[idx + 1].id);
        } else {
          const newId = crypto.randomUUID();
          setRows(prev => [...prev, { id: newId, product: null, qty: '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }]);
          setEditingRowId(newId);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = currentRows.findIndex(i => i.id === rowId);
      if (idx < currentRows.length - 1) setTimeout(() => focusCell(currentRows[idx + 1].id, col), 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = currentRows.findIndex(i => i.id === rowId);
      if (idx > 0) setTimeout(() => focusCell(currentRows[idx - 1].id, col), 0);
    }
  }, [focusCell]);

// ─── Camera / Scanner Logic ─────────────────────────────────────────────
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start(); osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) { console.error('Audio beep failed:', e); }
  };

  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1250, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc.start(); osc.stop(audioCtx.currentTime + 0.16);
    } catch (e) { console.error('Audio beep failed:', e); }
  };

  const handleStartScan = (rowId: string, mode: 'PRODUCT' | 'LOT') => {
    setActiveScanRowId(rowId);
    setScanMode(mode);
    setScannerError(null);
  };

  useEffect(() => {
    if (!activeScanRowId) return;
    let scanner: Html5Qrcode | null = null;
    const timer = setTimeout(async () => {
      try {
        scanner = new Html5Qrcode("reader");
        setScannerInstance(scanner);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.35 }) },
          (decodedText) => {
            playScanBeep();
            if (scanMode === 'PRODUCT') {
              handleScanProductCode(activeScanRowId, decodedText);
            } else {
              handleLotChange(activeScanRowId, decodedText);
            }
            if (scanner) scanner.stop().catch(console.error);
            setActiveScanRowId(null);
            setScanMode(null);
            setScannerInstance(null);
          },
          () => {}
        );
      } catch (err: any) {
        console.error("Camera init failed:", err);
        setScannerError(err.message || "ไม่สามารถเข้าถึงกล้องถ่ายรูปได้");
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      if (scanner && scanner.isScanning) scanner.stop().catch(console.error);
    };
  }, [activeScanRowId]);

  const handleCloseScan = async () => {
    if (scannerInstance && scannerInstance.isScanning) await scannerInstance.stop().catch(console.error);
    setActiveScanRowId(null);
    setScanMode(null);
    setScannerInstance(null);
  };

  const handleScanProductCode = async (rowId: string, barcode: string) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, drug_code, generic_name, trade_name, pack_size, manual_monthly_usage, is_psycho_narco, is_high_alert, is_cold_storage, master_units(name:unit_name), master_dosage_forms(name_en, abbreviation)')
        .eq('is_active', true)
        .or(`drug_code.eq.${barcode},generic_name.ilike.%${barcode}%`)
        .limit(1);
      
      if (data && data[0]) {
        const p = data[0];
        handleProductSelect(rowId, {
          id: p.id,
          drug_code: p.drug_code,
          generic_name: p.generic_name,
          trade_name: p.trade_name,
          pack_size: p.pack_size,
          is_psycho_narco: p.is_psycho_narco,
          is_high_alert: p.is_high_alert,
          is_cold_storage: p.is_cold_storage,
          unit_id: Array.isArray(p.master_units) ? p.master_units[0] : p.master_units,
          master_dosage_forms: p.master_dosage_forms as any
        } as ProductSearchResult);
      } else {
        alert('ไม่พบเวชภัณฑ์จากบาร์โค้ดนี้');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductStock = async (productId: string, whId: string) => {
    const { data } = await supabase
      .from('stock_balances')
      .select('current_qty, lots!inner(id, lot_number, expiry_date, unit_price)')
      .eq('product_id', productId)
      .eq('warehouse_id', whId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false, referencedTable: 'lots' });
      
    return (data || []).map((b: any) => ({
      current_qty: b.current_qty,
      lot_id: b.lots?.id,
      lot_number: b.lots?.lot_number,
      expiry_date: b.lots?.expiry_date,
      unit_price: b.lots?.unit_price
    }));
  };

  const recalculateErrors = (currentRows: DispenseRow[]) => {
    return currentRows.map(r => {
      if (!r.product || r.qty === '') return { ...r, previewError: false };
      const usedProductQty = currentRows
        .filter(row => row.product?.id === r.product!.id && row.qty !== '')
        .reduce((sum, row) => sum + Number(row.qty), 0);
      return { ...r, previewError: usedProductQty > r.totalStock };
    });
  };

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

    setRows(prevRows => {
      const newRows = prevRows.map(r => {
        if (r.id === rowId) {
          return {
            ...r,
            product,
            totalStock: sumStock,
            availableBalances: stockData,
            qty: '' as number | '',
            pack_size: product.pack_size || 1,
            unit_name: product.unit_id?.name || '',
            selected_lot: stockData.length > 0 ? stockData[0].lot_number : '',
            previewError: false
          };
        }
        return r;
      });
      return recalculateErrors(newRows);
    });
    setEditingRowId(null);
    setTimeout(() => focusCell(rowId, 'qty'), 100);
  };

  const handleClearProduct = (rowId: string) => {
    setRows(prevRows => {
      const newRows = prevRows.map(r => {
        if (r.id === rowId) {
          return { ...r, product: null, qty: '' as number | '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], previewError: false };
        }
        return r;
      });
      return recalculateErrors(newRows);
    });
  };

  const handleQtyChange = (rowId: string, val: string) => {
    setRows(prevRows => {
      const newRows = prevRows.map(r => {
        if (r.id === rowId) {
          const num = val === '' ? '' : parseInt(val);
          const qtyVal = num === '' || isNaN(num) ? '' : Math.max(1, num);
          return { ...r, qty: qtyVal as number | '' };
        }
        return r;
      });
      return recalculateErrors(newRows);
    });
  };

  const handleLotChange = (rowId: string, lotNumber: string) => {
    setRows(prevRows => {
      const newRows = prevRows.map(r => {
        if (r.id === rowId) {
          if (r.availableBalances.length > 0) {
            const oldestLot = r.availableBalances[0];
            if (oldestLot.lot_number !== lotNumber) {
              const confirmMsg = `แจ้งเตือน FEFO: มีเวชภัณฑ์ล็อตที่หมดอายุก่อน (Lot: ${oldestLot.lot_number}) คุณต้องการจ่ายล็อต ${lotNumber} แทนใช่หรือไม่?`;
              if (!window.confirm(confirmMsg)) return r;
            }
          }
          return { ...r, selected_lot: lotNumber };
        }
        return r;
      });
      return recalculateErrors(newRows);
    });
  };

  const handleRemarkChange = (rowId: string, remark: string) => {
    setRows(prevRows => prevRows.map(r => r.id === rowId ? { ...r, remark } : r));
  };

  const handleAddRow = () => {
    const newId = crypto.randomUUID();
    setRows(prev => [
      ...prev,
      { id: newId, product: null, qty: '' as number | '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }
    ]);
    setEditingRowId(newId);
  };

  // Global listener: Alt+A to add row, Alt+H to toggle help
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        handleAddRow();
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleRemoveRow = (rowId: string) => {
    setRows(prevRows => {
      let newRows = prevRows.filter(r => r.id !== rowId);
      if (newRows.length === 0) {
        newRows = [{ id: crypto.randomUUID(), product: null, qty: '' as number | '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }];
      }
      return recalculateErrors(newRows);
    });
  };

  const handleAutoSplitRow = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !row.product || !row.qty) return;
    const qtyToAllocate = Number(row.qty);
    
    // Sort available balances in FEFO (already sorted by expiry date in availableBalances)
    const lots = row.availableBalances;
    let remainingQty = qtyToAllocate;
    const newRows: DispenseRow[] = [];
    
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
          totalStock: row.totalStock,
          availableBalances: row.availableBalances,
          remark: row.remark
        });
        remainingQty -= allocQty;
      }
    }
    
    // If there's still remaining quantity (which shouldn't happen if total stock is sufficient)
    // we add it to the last row, which will trigger the normal validation error.
    if (remainingQty > 0 && newRows.length > 0) {
      newRows[newRows.length - 1].qty = Number(newRows[newRows.length - 1].qty) + remainingQty;
    }
    
    // Replace the original row with the new split rows in the rows list
    setRows(prevRows => {
      const idx = prevRows.findIndex(r => r.id === rowId);
      if (idx === -1) return prevRows;
      const updated = [...prevRows];
      updated.splice(idx, 1, ...newRows);
      return updated;
    });
  };

  const handleWarehouseChange = (newWhId: string) => {
    const hasData = rows.some(r => r.product || r.qty !== '');
    if (hasData && !confirm('หากทำการเปลี่ยนคลังควบคุมจ่าย ข้อมูลเวชภัณฑ์และจำนวนในตารางที่ระบุไว้จะถูกล้างใหม่ทั้งหมด คุณแน่ใจหรือไม่?')) return;
    setWarehouseId(newWhId);
    setRows([{ id: crypto.randomUUID(), product: null, qty: '' as number | '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }]);
  };

  const handleSaveDispense = async () => {
    // Validate and build final rows by simulating cumulative stock deduction
    let hasError = false;
    const finalRows: DispenseRow[] = [];
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
    if (validRows.length === 0) { alert('กรุณากรอกข้อมูลเวชภัณฑ์ยาและจำนวนอย่างถูกต้องอย่างน้อย 1 รายการ'); return; }
    if (!actorId) { alert('กรุณาระบุ ผู้จ่ายเวชภัณฑ์ (คลังย่อย) ในข้อมูลส่วนหัว'); return; }
    if (!toWarehouseId) { alert('กรุณาระบุ ปลายทางที่รับเวชภัณฑ์'); return; }

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
            remark: r.remark
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
              remark: r.remark
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

    if (hasError) { alert('พบข้อผิดพลาด "สต็อกในคลังไม่เพียงพอ" มีการเบิกรายการซ้ำจนสต็อกรวมหมด หรือระบุจำนวนที่เกินจริง กรุณาตรวจสอบจำนวนจ่ายอีกครั้ง'); return; }
    if (!confirm(`ยืนยันการบันทึกเอกสารตัดจ่ายเวชภัณฑ์? ทั้งหมด ${finalRows.length} รายการ`)) return;

    setIsSubmitting(true); setSuccessMsg(''); setInvoiceResults(null); setDispenseDocId(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('ไม่พบข้อมูลเซสชั่นผู้ใช้ กรุณาล็อกอินใหม่');
      const creator = officers.find(s => s.id === user.id);

      const { data: movement, error: moveError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'DISPENSE',
          from_warehouse_id: warehouseId,
          to_warehouse_id: toWarehouseId,
          doc_date: docDate,
          actor_id: actorId,
          note: headerNote || null,
          created_by: user.id,
          created_by_position: creator?.position || null
        })
        .select('id')
        .single();

      if (moveError) throw moveError;
      setDispenseDocId(movement.id);

      const finalInvoiceList: DispenseResultItem[] = [];

      for (const row of validRows) {
        const lotData = row.availableBalances.find(b => b.lot_number === row.selected_lot)!;
        
        const { error: itemError } = await supabase.from('stock_movement_items').insert({
          movement_id: movement.id,
          product_id: row.product!.id,
          lot_id: lotData.lot_id,
          qty: Number(row.qty),
          pack_size: row.pack_size,
          unit_name: row.unit_name,
          unit_price: lotData.unit_price || 0,
          remark: row.remark || null
        });
        if (itemError) throw itemError;
        
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

        const existing = finalInvoiceList.find(item => item.generic_name === row.product!.generic_name);
        if (existing) {
          existing.qty += Number(row.qty);
          existing.lots.push({ lot_number: lotData.lot_number, qty: Number(row.qty) });
        } else {
          finalInvoiceList.push({
            generic_name: row.product!.generic_name,
            qty: Number(row.qty),
            lots: [{ lot_number: lotData.lot_number, qty: Number(row.qty) }]
          });
        }
      }

      playSuccessBeep();
      setSuccessMsg('บันทึกใบจ่ายเวชภัณฑ์และหักยอดสต๊อกเรียบร้อยแล้ว!');
      setInvoiceResults(finalInvoiceList);

      // ── Clear IDB draft immediately after successful submit ───────────────
      await clearDraft();
      setPendingDraft(null);

      setRows([{ id: crypto.randomUUID(), product: null, qty: '', pack_size: 1, unit_name: '', selected_lot: '', totalStock: 0, availableBalances: [], remark: '' }]);
      setDocDate(new Date().toISOString().split('T')[0]);
      setHeaderNote('');

    } catch (err: any) {
      console.error('Error saving dispense transaction:', err);
      alert('เกิดข้อผิดพลาดในการตัดจ่ายสต๊อก: ' + (err.message === 'INSUFFICIENT_STOCK' ? 'สต๊อกคงเหลือเปลี่ยนไประหว่างทำรายการ กรุณาดึงข้อมูลสต๊อกใหม่' : err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRows = rows.filter(r => r.product && Number(r.qty) > 0);
  const totalItemsCount = activeRows.length;
  const runningTotalQty = activeRows.reduce((sum, r) => sum + Number(r.qty), 0);

  return (
    <div className="max-w-full mx-auto space-y-6 pb-20">

      {/* ── Draft Restore Banner ──────────────────────────────────────────── */}
      {pendingDraft && (
        <div className="animate-fade-in-up relative overflow-hidden rounded-2xl shadow-lg" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 40%, #8b5cf6 80%, #3b82f6 100%)'}}>
          {/* Shimmer sweep */}
          <div className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 2.4s infinite linear'}} />
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner border border-white/30">
                <RotateCcw size={22} className="text-white drop-shadow" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-white text-sm drop-shadow">🔄 พบร่างเอกสารที่บันทึกไว้เมื่อ {formatDraftTimestamp(pendingDraft.savedAt)}</p>
                <p className="text-white/85 text-xs font-semibold mt-0.5">ต้องการกู้คืนข้อมูลนั้นกลับมาไหม? หากไม่กู้คืน ข้อมูลจะถูกลบทิ้ง</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-4 py-2 text-sm font-extrabold text-white/90 bg-white/15 border border-white/30 rounded-xl hover:bg-white/25 transition-all backdrop-blur-sm cursor-pointer"
              >
                ❌ ไม่ใช่ เริ่มใหม่
              </button>
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="px-5 py-2 text-sm font-black text-gray-900 bg-white rounded-xl hover:bg-yellow-50 transition-all shadow-md cursor-pointer"
              >
                ✅ ใช่ กู้คืน
              </button>
            </div>
          </div>
        </div>
      )}
      
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-up">
          <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={24} />
          <span className="font-extrabold">{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
            <Pill size={28} />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">ตัดจ่ายเวชภัณฑ์</h1>
            </div>
            <p className="text-gray-500 font-medium mt-1">บันทึกจ่ายเวชภัณฑ์ออกจากตู้คลังย่อย ไปยังจุดบริการ</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" icon={<FileSpreadsheet size={18} />}>
            นำเข้าประวัติจาก Excel
          </Button>
          <Button variant="outline" onClick={() => navigate('/reports/movements?type=DISPENSE')} icon={<History size={18} />}>
            ประวัติการจ่าย (Void)
          </Button>
        </div>
      </div>

      <Card className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 animate-fade-in-up">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">เลขที่เอกสาร</label>
          <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 font-mono flex items-center justify-between">
            <span>DIS{docDate.replace(/-/g, '')}-XX</span>
            <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Auto</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">วันที่จ่าย <span className="text-red-500">*</span></label>
          <DatePicker value={docDate} onChange={setDocDate} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">คลังต้นทาง <span className="text-red-500">*</span></label>
          <select value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)} disabled={isSubmitting || isWarehousesLoading} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">จ่ายไปที่ (คลังปลายทาง) <span className="text-red-500">*</span></label>
          <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} disabled={isSubmitting || isWarehousesLoading} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium">
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">ผู้จ่ายเวชภัณฑ์ (คลังย่อย) <span className="text-red-500">*</span></label>
          <CustomOfficerSelect value={actorId} onChange={setActorId} officers={officers} placeholder="-- เลือกผู้จ่าย --" />
        </div>
        <div className="md:col-span-5">
          <label className="block text-sm font-bold text-gray-700 mb-1">หมายเหตุเอกสาร</label>
          <input type="text" value={headerNote} onChange={e => setHeaderNote(e.target.value)} placeholder="เช่น จ่ายให้ตึกผู้ป่วยใน ชั้น 3" className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
        </div>
      </Card>

      <Card className="overflow-visible animate-fade-in-up">
        <h3 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-2 mb-4">
          <Activity size={16} /> รายการใบจ่ายเวชภัณฑ์ยา
        </h3>

        <div className="min-h-[250px] overflow-visible pb-10 lg:pb-32">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-[3rem_minmax(250px,1fr)_140px_220px_110px_160px_4rem] xl:grid-cols-[3rem_minmax(300px,1fr)_140px_220px_110px_160px_4rem] gap-2 px-4 py-3 border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
            <div className="text-center">#</div>
            <div>เวชภัณฑ์ (ค้นหา / สแกน)</div>
            <div className="text-right pr-4">จำนวนจ่าย</div>
            <div className="text-center">ล็อต (FEFO)</div>
            <div className="text-center">วันหมดอายุ</div>
            <div>หมายเหตุ</div>
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
                  <div className="relative group overflow-visible lg:grid lg:grid-cols-[3rem_minmax(250px,1fr)_140px_220px_110px_160px_4rem] xl:grid-cols-[3rem_minmax(300px,1fr)_140px_220px_110px_160px_4rem] lg:gap-2 items-center bg-white rounded-3xl shadow-sm border border-gray-100 lg:border-none lg:shadow-none lg:rounded-none p-4 lg:p-0 hover:bg-gray-50/30 transition-colors" style={{ zIndex: 40 - index }}>
                    
                    {/* Mobile Card Header */}
                    <div className="flex lg:hidden justify-between items-center mb-3 pb-3 border-b border-gray-50">
                      <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">รายการที่ {index + 1}</span>
                      <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>

                    {/* Desktop Index */}
                    <div className="hidden lg:block py-4 px-4 text-center font-bold text-gray-400">{index + 1}</div>
                    
                    {/* Product Search & Scan */}
                    <div className="py-2 lg:py-4 lg:px-4 relative overflow-visible">
                      <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">1. ค้นหาเวชภัณฑ์ หรือสแกน</label>
                      {!row.product || editingRowId === row.id ? (
                        <div className="relative z-50 flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <ProductSearchInput
                              warehouseId={warehouseId}
                              onSelect={(product) => handleProductSelect(row.id, product)}
                              placeholder={row.product ? "ค้นหายาเพื่อเปลี่ยน..." : "พิมพ์ค้นหา หรือรหัสคีย์..."}
                              className="w-full text-base lg:text-sm py-3 lg:py-2.5"
                              onClickOutside={() => setEditingRowId(null)}
                              autoFocus={editingRowId === row.id}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartScan(row.id, 'PRODUCT')}
                            className="p-3.5 lg:p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                            title="สแกนบาร์โค้ดยา"
                          >
                            <Camera size={22} className="lg:w-4 lg:h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div 
                            onClick={() => setEditingRowId(row.id)}
                            className="flex-1 flex items-center justify-between p-3 lg:p-2.5 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-100 hover:border-emerald-300 rounded-xl text-emerald-900 shadow-inner cursor-pointer transition-all group/item min-w-0"
                            title="คลิกเพื่อเปลี่ยนเวชภัณฑ์"
                          >
                            <div className="flex flex-col gap-1 w-full min-w-0">
                              <span className="font-extrabold text-base lg:text-sm text-gray-900 truncate">
                                {row.product.generic_name}
                                {row.product.trade_name && <span className="text-gray-500 font-medium text-xs ml-1.5">({row.product.trade_name})</span>}
                              </span>
                              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                <span className="text-[10px] lg:text-[10px] bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded font-mono font-bold uppercase">{row.product.drug_code || '-'}</span>
                                {row.product.is_high_alert && <span className="text-[10px] lg:text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold animate-pulse">High Alert</span>}
                                {row.product.is_psycho_narco && <span className="text-[10px] lg:text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Psycho</span>}
                              </div>
                            </div>
                            <div className="p-1.5 text-emerald-400 group-hover/item:text-emerald-600 group-hover/item:bg-white rounded-full transition-all shrink-0 hidden lg:block"><Search size={16} /></div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartScan(row.id, 'PRODUCT')}
                            className="p-3.5 lg:p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                            title="สแกนบาร์โค้ดยา"
                          >
                            <Camera size={22} className="lg:w-4 lg:h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:contents">
                      {/* Qty & Unit */}
                      <div className="py-2 lg:py-4 lg:px-4 text-left lg:text-right flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">2. จำนวนจ่าย</label>
                        <div className="flex items-center gap-1.5 lg:justify-end">
                          <input
                            ref={setCellRef(row.id, 'qty')}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, 'qty')}
                            type="number" min="1" placeholder="0"
                            value={row.qty} onChange={(e) => handleQtyChange(row.id, e.target.value)}
                            disabled={!row.product || isSubmitting}
                            className={`w-full lg:w-20 px-3 py-3 lg:py-2.5 bg-white/70 backdrop-blur-sm border rounded-xl outline-none transition-all text-base lg:text-sm font-extrabold text-center shadow-sm
                              ${!row.product ? 'border-gray-100 text-gray-300' : row.previewError ? 'border-red-400 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-100' : 'border-emerald-200 text-emerald-800 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500'}
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
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5 text-left">3. เลือกล็อต</label>
                        {!row.product ? <span className="text-gray-300 font-bold text-xs italic text-left lg:text-center block py-3 lg:py-0">-</span> : (
                          <div className="flex gap-2 relative overflow-visible">
                            <CustomLotSelect
                              value={row.selected_lot}
                              onChange={(val) => handleLotChange(row.id, val)}
                              options={row.availableBalances}
                              hasError={row.previewError}
                              setCellRef={setCellRef(row.id, 'selected_lot')}
                              onKeyDown={(e) => handleCellKeyDown(e as any, row.id, 'selected_lot')}
                              unitName={row.unit_name || 'ชิ้น'}
                            />
                            <button type="button" onClick={() => handleStartScan(row.id, 'LOT')} className="p-3 lg:p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl transition-all shrink-0" title="สแกนบาร์โค้ด Lot">
                              <Camera size={20} className="lg:w-[18px] lg:h-[18px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:contents">
                      {/* Expiry */}
                      <div className="py-2 lg:py-4 lg:px-4 text-left lg:text-center text-sm font-bold flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">วันหมดอายุ</label>
                        <div className="py-2.5 lg:py-0">
                          {row.product && row.selected_lot ? (() => {
                            const lot = row.availableBalances.find(b => b.lot_number === row.selected_lot);
                            if (lot && lot.expiry_date) {
                              const expiry = new Date(lot.expiry_date);
                              const isNearExpiry = (expiry.getTime() - new Date().getTime()) < (6 * 30 * 24 * 60 * 60 * 1000); // 6 months
                              return (
                                <span className={isNearExpiry ? "text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg" : "text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg"}>
                                  {expiry.toLocaleDateString('en-GB')}
                                </span>
                              );
                            }
                            return <span className="text-gray-300">-</span>;
                          })() : <span className="text-gray-300">-</span>}
                        </div>
                      </div>

                      {/* Remark */}
                      <div className="py-2 lg:py-4 lg:px-4 text-center flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5 text-left">หมายเหตุ</label>
                        <input
                          ref={setCellRef(row.id, 'remark')}
                          onKeyDown={(e) => handleCellKeyDown(e, row.id, 'remark')}
                          type="text" placeholder="ระบุเหตุผล"
                          value={row.remark} onChange={(e) => handleRemarkChange(row.id, e.target.value)}
                          disabled={!row.product || isSubmitting}
                          className="w-full text-base lg:text-sm px-3 py-3 lg:py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                        />
                      </div>
                    </div>

                    {/* Desktop Manage Action */}
                    <div className="hidden lg:block py-4 px-4 text-center">
                      <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
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
              );
            })}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 hidden lg:flex flex-col md:flex-row justify-between items-center gap-4">
          <Button type="button" variant="outline" onClick={handleAddRow} disabled={isSubmitting} icon={<Plus size={18} />}>เพิ่มบรรทัดรายการเวชภัณฑ์</Button>
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">จำนวนเวชภัณฑ์ที่จ่าย</span>
              <span className="text-base font-extrabold text-emerald-800">{totalItemsCount} รายการ</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">รวมจำนวนหักลดคลัง</span>
              <span className="text-base font-extrabold text-emerald-800">{runningTotalQty} หน่วย</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Spacer for sticky mobile bottom bar */}
      <div className="h-28 lg:hidden"></div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-gray-200 p-4 pb-safe lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-none lg:p-0 lg:z-auto lg:flex lg:justify-end lg:pt-4 lg:pb-0 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] lg:shadow-none transition-all">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 lg:justify-end w-full">
          <div className="flex lg:hidden justify-between items-center px-2 pb-1">
            <div className="text-xs font-bold text-gray-500">รวมทั้งหมด <span className="text-emerald-700 text-sm font-black">{totalItemsCount}</span> รายการ</div>
            <div className="text-xs font-bold text-gray-500">ยอดรวม <span className="text-emerald-700 text-sm font-black">{runningTotalQty}</span> หน่วย</div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleAddRow} disabled={isSubmitting} className="flex-1 lg:hidden bg-white border-emerald-200 text-emerald-700 shadow-sm" icon={<Plus size={20} />}>
              เพิ่ม
            </Button>
            <Button type="button" onClick={handleSaveDispense} disabled={isSubmitting || totalItemsCount === 0} icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />} size="lg" className="flex-[2] lg:flex-none shadow-emerald-500/30 shadow-lg lg:shadow-none text-base">
              {isSubmitting ? 'กำลังจัดสรร...' : 'บันทึกใบจ่ายเวชภัณฑ์'}
            </Button>
          </div>
        </div>
      </div>

      {activeScanRowId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold flex items-center gap-2"><Camera className="text-emerald-600" /> สแกนบาร์โค้ดยาหรือล็อต</h3>
              <button onClick={handleCloseScan} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
            </div>
            {scannerError ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 flex gap-2">
                <AlertCircle size={18} className="shrink-0" /> {scannerError}
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 bg-black aspect-square">
                <div id="reader" className="w-full h-full object-cover"></div>
                <div className="absolute inset-0 pointer-events-none shadow-[0_0_0_999px_rgba(0,0,0,0.5)] z-10 m-[15%] rounded-xl border border-white/30">
                  <div className="absolute inset-0 border-2 border-emerald-500 rounded-xl animate-pulse"></div>
                </div>
              </div>
            )}
            <p className="text-center text-xs text-gray-500 mt-4 font-bold">หันกล้องให้เห็นบาร์โค้ดชัดเจน</p>
          </div>
        </div>
      )}

      {invoiceResults && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer" onClick={() => setInvoiceResults(null)}></div>
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-emerald-950 to-neutral-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl z-10 animate-fade-in-up max-h-[85vh] overflow-y-auto">
            <button onClick={() => setInvoiceResults(null)} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 flex items-center justify-center border border-emerald-400/30"><FileText className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2"><span>บันทึกใบสั่งจ่ายสำเร็จเรียบร้อย!</span><Sparkles size={16} className="text-emerald-400 animate-pulse" /></h3>
                <p className="text-xs text-emerald-400">ใบเสร็จการตัดคลังแบบ First-Expired, First-Out (FEFO Summary)</p>
              </div>
            </div>
            <div className="space-y-4 text-sm font-medium">
              <p className="text-emerald-300/80">ระบบได้ดำเนินการล็อกตำแหน่งและเบิกสินค้าออกจากตู้จ่ายย่อยเรียบร้อยแล้ว โดยจัดสรรล็อตการตัดจ่ายดังตารางด้านล่างนี้:</p>
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/10 text-emerald-300 font-extrabold border-b border-white/5">
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">เวชภัณฑ์ยา</th>
                      <th className="p-3 text-right">จำนวนรวม</th>
                      <th className="p-3">ล็อตและจำนวนหักจ่ายที่เลือกตัด (FEFO Allocation)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoiceResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-white">{item.generic_name}</td>
                        <td className="p-3 text-right text-sm font-black text-emerald-400 bg-emerald-500/5">{item.qty}</td>
                        <td className="p-3 text-gray-300 space-y-1">
                          {item.lots.map((l, i) => (
                            <div key={i} className="flex items-center gap-1.5 font-mono text-[11px]"><span className="bg-white/10 px-2 py-0.5 rounded text-white border border-white/5">Lot: {l.lot_number}</span><span className="font-sans font-bold text-emerald-400">หักออก {l.qty} หน่วย</span></div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-8 flex justify-between items-center border-t border-white/10 pt-6">
              {dispenseDocId ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate(`/movement/print/${dispenseDocId}`)} icon={<Printer size={18} />} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors bg-transparent">พิมพ์ใบจ่ายเวชภัณฑ์</Button>
                  <Button variant="outline" onClick={async () => {
                    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการ Void (ยกเลิก) รายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะคืนยอดสต๊อกกลับไป')) return;
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');
                      const { error } = await supabase.rpc('void_stock_movement', { p_movement_id: dispenseDocId, p_user_id: user.id });
                      if (error) throw error;
                      alert('Void รายการสำเร็จ! (คืนสต๊อกแล้ว)');
                      setInvoiceResults(null);
                    } catch (err: any) { alert('ไม่สามารถ Void ได้: ' + err.message); }
                  }} icon={<Ban size={18} />} className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors bg-transparent">ยกเลิกบิล (Void)</Button>
                </div>
              ) : <div></div>}
              <Button onClick={() => setInvoiceResults(null)}>เสร็จสิ้นการยืนยัน</Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= KEYBOARD HELP MODAL ================= */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="คู่มือทางลัดคีย์บอร์ด">
          {/* Backdrop */}
          <div
            onClick={() => setIsHelpOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal box */}
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl z-10 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight">คู่มือทางลัดคีย์บอร์ด</h2>
                    <p className="text-emerald-100 text-xs font-medium mt-0.5">หน้าจ่ายเวชภัณฑ์</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                  title="ปิด (Escape)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Shortcut sections */}
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Section: การนำทางในตาราง */}
              <section>
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">การนำทางในตาราง</h3>
                <div className="space-y-1.5">
                  {[
                    { keys: ['Tab'], desc: 'ถัดไป — เลื่อนไปช่องถัดไปในแถวเดียวกัน' },
                    { keys: ['Shift', 'Tab'], desc: 'ย้อนกลับ — เลื่อนไปช่องก่อนหน้าในแถวเดียวกัน' },
                    { keys: ['Enter'], desc: 'ยืนยัน — ถัดไป เหมือน Tab' },
                    { keys: ['↑'], desc: 'เลื่อนขึ้น — ไปแถวก่อนหน้า (คอลัมน์เดิม)' },
                    { keys: ['↓'], desc: 'เลื่อนลง — ไปแถวถัดไป (คอลัมน์เดิม)' },
                  ].map(({ keys, desc }) => (
                    <div key={desc} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 shrink-0 min-w-[110px] justify-end">
                        {keys.map((k, i) => (
                          <span key={i} className="inline-flex items-center justify-center px-2 py-1 bg-gray-100 border border-gray-300 rounded-md text-[11px] font-mono font-bold text-gray-700 shadow-sm">{k}</span>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="border-t border-dashed border-gray-200" />

              {/* Section: ทางลัดอื่นๆ */}
              <section>
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">ทางลัดอื่นๆ</h3>
                <div className="space-y-1.5">
                  {[
                    { keys: ['Alt', 'A'], desc: 'เพิ่มแถวใหม่' },
                    { keys: ['Alt', 'H'], desc: 'เปิด / ปิด คู่มือทางลัดนี้' },
                    { keys: ['Esc'], desc: 'ปิด Dropdown / ปิดหน้าต่างนี้' },
                    { keys: ['↑', '↓'], desc: 'เลื่อน Dropdown รายการยา (ขณะค้นหา)' },
                    { keys: ['Enter'], desc: 'เลือกรายการยาจาก Dropdown' },
                  ].map(({ keys, desc }) => (
                    <div key={desc} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 shrink-0 min-w-[110px] justify-end">
                        {keys.map((k, i) => (
                          <span key={i} className="inline-flex items-center justify-center px-2 py-1 bg-gray-100 border border-gray-300 rounded-md text-[11px] font-mono font-bold text-gray-700 shadow-sm">{k}</span>
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">กด <span className="font-mono font-bold bg-gray-200 px-1.5 py-0.5 rounded">Esc</span> หรือคลิกพื้นหลังเพื่อปิด</p>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      <DispenseRelationalImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // You might want to refresh the stock balances or products after a successful import.
          // Since the component is quite complex and relies on searches, just closing is fine.
          // The user can refresh or search again to see updated stocks.
        }}
      />
    </div>
  );
}
