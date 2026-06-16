import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getDefaultOfficers, getMasterFiscalYears } from '@/lib/supabase/queries';
import { ProductSearchResult } from '@/types';
import { useOfficers } from '@/hooks/useOfficers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

interface ReceiveItem {
  id: string; // คีย์ชั่วคราวสำหรับ UI
  requisition_item_id?: string; // ถ้ามาจากใบเบิก
  product: ProductSearchResult | null; // ข้อมูลยาที่เลือก
  lot_number: string;
  expiry_date: string;
  qty: number | '';
  pack_size: number;
  unit_name: string;
  unit_price: number | '';
  remark?: string;
  drug_code?: string;
}

export interface MasterFiscalYear {
  id: string;
  year_name: string;
  is_active: boolean;
}

export interface RequisitionItem {
  id: string;
  qty: number;
  received_qty?: number;
  product_id: string;
  product: {
    id: string;
    drug_code?: string;
    generic_name: string;
    pack_size?: number;
    unit_price?: number;
    is_cold_storage?: boolean;
    is_high_alert?: boolean;
    unit_id?: { name?: string; unit_name?: string };
    master_dosage_forms?: { name_en?: string; abbreviation?: string };
  };
}

export interface RequisitionData {
  id: string;
  doc_no: string;
  doc_date: string;
  status: string;
  requester?: { full_name: string };
  items?: RequisitionItem[];
}

export interface OfficerInfo {
  id: string;
  full_name: string;
  position?: string;
  user_id?: string;
  role_key?: string;
}

export function useReceiveForm() {
  const navigate = useNavigate();
  const initialId = useRef(crypto.randomUUID());
  const [items, setItems] = useState<ReceiveItem[]>(() => [
    { id: initialId.current, product: null, lot_number: '', expiry_date: '', qty: '', pack_size: 1, unit_name: '', unit_price: '', remark: '' }
  ]);
  const [editingRowId, setEditingRowId] = useState<string | null>(() => initialId.current);
  
  const { officers } = useOfficers(true); // เฉพาะเจ้าหน้าที่ที่ยังใช้งานอยู่ (active only)

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // --- Header States ---
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiscalYearId, setFiscalYearId] = useState<string>('');
  const [fiscalYears, setFiscalYears] = useState<MasterFiscalYear[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState<string>('');   // รับจาก (คลังหลัก)
  const [warehouseId, setWarehouseId] = useState<string>('');           // รับเข้าคลัง (คลังย่อย)
  const [actorId, setActorId] = useState('');                           // ผู้รับเวชภัณฑ์
  const [approverMainId, setApproverMainId] = useState('');             // ผู้อนุมัติจ่าย (คลังหลัก)
  const [issuerMainId, setIssuerMainId] = useState('');           // ผู้จ่ายเวชภัณฑ์ (คลังหลัก)
  const [headerNote, setHeaderNote] = useState('');                     // หมายเหตุ
  const [refDocNo, setRefDocNo] = useState('');
  const [refDocDate, setRefDocDate] = useState('');
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
  const [selectedRequisitionData, setSelectedRequisitionData] = useState<RequisitionData | null>(null);
  const [isReqDetailModalOpen, setIsReqDetailModalOpen] = useState(false);

  // --- Import States ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRelationalImportOpen, setIsRelationalImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'preview'>('upload');
  const [importError, setImportError] = useState('');
  const [importItems, setImportItems] = useState<ReceiveItem[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { warehouses } = useWarehouses();

  // Default warehouses by name: หลัก → from, ย่อย/sub → to
  useEffect(() => {
    if (warehouses && warehouses.length > 0) {
      if (!fromWarehouseId) {
        const main = warehouses.find(w =>
          /stock|หลัก/i.test(w.name) && !/ย่อย|sub/i.test(w.name)
        ) || warehouses[0];
        setFromWarehouseId(main.id);
      }
      if (!warehouseId) {
        const sub = warehouses.find(w => /ย่อย|sub/i.test(w.name)) || warehouses[warehouses.length - 1];
        setWarehouseId(sub.id);
      }
    }
  }, [warehouses]);

  // Fetch fiscal years
  useEffect(() => {
    const fetchFY = async () => {
      const data = await getMasterFiscalYears();
      if (data) {
        setFiscalYears(data);
        const active = data.find(f => f.is_active);
        if (active) setFiscalYearId(active.id);
        else if (data.length > 0) setFiscalYearId(data[0].id);
      }
    };
    fetchFY();
  }, []);

  // Default officers: ดึงจาก default_officers ใช้ role_key ที่ตั้งค่าในหน้า Settings → Default Officers
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const data = await getDefaultOfficers();
        if (!data) return;
        const find = (key: string) => data.find((o: any) => o.role_key === key)?.user_id || '';
        const app  = find('approver_main_warehouse');
        const disp = find('issuer_main_warehouse');
        const recv = find('receiver'); // 'receiver' = ผู้รับเวชภัณฑ์ (กำหนดในตั้งค่า → เจ้าหน้าที่คลังย่อย)
        if (app)  setApproverMainId(app);
        if (disp) setIssuerMainId(disp);
        if (recv) setActorId(recv);
      } catch (e) { console.error(e); }
    };
    loadDefaults();
  }, []);




  // --- Modal States ---
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [pendingRequisitions, setPendingRequisitions] = useState<RequisitionData[]>([]);
  const [isFetchingReqs, setIsFetchingReqs] = useState(false);

  // Scanner States
  const [activeScanRowId, setActiveScanRowId] = useState<string | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Help modal
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // ─── Keyboard Navigation ──────────────────────────────────────────────────
  // Column order for Tab/Enter navigation (product column handled separately via ProductSearchInput)
  const COLUMNS = ['qty', 'lot_number', 'expiry_date', 'unit_price', 'remark'] as const;
  type NavColumn = typeof COLUMNS[number];

  // Ref map: key = `${rowId}-${column}`, value = HTMLInputElement
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setCellRef = useCallback((rowId: string, col: NavColumn) => (el: HTMLInputElement | null) => {
    const key = `${rowId}-${col}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  }, []);

  const focusCell = useCallback((rowId: string, col: NavColumn) => {
    const el = cellRefs.current.get(`${rowId}-${col}`);
    if (el) {
      el.focus();
      if (el.type !== 'date') el.select();
    }
  }, []);

  // Navigate to next/prev cell or row
  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowId: string,
    col: NavColumn
  ) => {
    const colIndex = COLUMNS.indexOf(col);

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (colIndex < COLUMNS.length - 1) {
        // Move to next column in same row
        focusCell(rowId, COLUMNS[colIndex + 1]);
      } else {
        // Last column → move to product search of next row (or add new row)
        const idx = items.findIndex(i => i.id === rowId);
        if (idx < items.length - 1) {
          setEditingRowId(items[idx + 1].id);
        } else {
          // Add new row
          const newId = crypto.randomUUID();
          const newRow = { id: newId, product: null, lot_number: '', expiry_date: '', qty: '' as const, pack_size: 1, unit_name: '', unit_price: '' as const, remark: '' };
          setItems(prev => [...prev, newRow]);
          setEditingRowId(newId);
        }
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (colIndex > 0) {
        focusCell(rowId, COLUMNS[colIndex - 1]);
      }
      // If first column, let browser handle back navigation naturally
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex < COLUMNS.length - 1) {
        focusCell(rowId, COLUMNS[colIndex + 1]);
      } else {
        // Enter on last column → move to product search of next row or add new row
        const idx = items.findIndex(i => i.id === rowId);
        if (idx < items.length - 1) {
          setEditingRowId(items[idx + 1].id);
        } else {
          const newId = crypto.randomUUID();
          const newRow = { id: newId, product: null, lot_number: '', expiry_date: '', qty: '' as const, pack_size: 1, unit_name: '', unit_price: '' as const, remark: '' };
          setItems(prev => [...prev, newRow]);
          setEditingRowId(newId);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === rowId);
        if (idx < prev.length - 1) {
          setTimeout(() => focusCell(prev[idx + 1].id, col), 0);
        }
        return prev;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === rowId);
        if (idx > 0) {
          setTimeout(() => focusCell(prev[idx - 1].id, col), 0);
        }
        return prev;
      });
    }
  }, [focusCell, COLUMNS]);

  // Alt+H global listener to toggle help modal, Alt+A to add new row
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setIsHelpOpen(prev => !prev);
      }
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        handleAddRow();
      }
      if (e.key === 'Escape') {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // ดึงใบเบิกที่ยังไม่เสร็จสิ้น
  const fetchPendingRequisitions = async () => {
    setIsFetchingReqs(true);
    try {
      const { data, error } = await supabase
        .from('requisitions')
        .select(`
          *,
          requester:officers!requester_id(full_name),
          items:requisition_items(
            id, qty, product_id,
            product:products(id, drug_code, generic_name, pack_size, unit_price, is_cold_storage, is_high_alert, unit_id:unit_id(name:unit_name), master_dosage_forms(name_en, abbreviation))
          )
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setPendingRequisitions(data || []);
    } catch (err: unknown) {
      alert("โหลดใบเบิกไม่สำเร็จ: " + (err as Error).message);
    } finally {
      setIsFetchingReqs(false);
    }
  };

  const loadRequisition = (req: RequisitionData) => {
    if (items.some(i => i.product !== null) && !confirm("ข้อมูลบนตารางปัจจุบันจะถูกล้างทิ้งและแทนที่ด้วยใบเบิกนี้ ยืนยันหรือไม่?")) {
      return;
    }
    setSelectedRequisitionId(req.id);
    setSelectedRequisitionData(req);
    if (req.items && req.items.length > 0) {
      // Sort items by dosage form then COLD then HAD then product generic name
      const sortedItems = [...req.items].sort((a: RequisitionItem, b: RequisitionItem) => {
        const dfA = a.product?.master_dosage_forms?.name_en || '';
        const dfB = b.product?.master_dosage_forms?.name_en || '';
        if (dfA !== dfB) return dfA.localeCompare(dfB);

        const coldA = a.product?.is_cold_storage ? 1 : 0;
        const coldB = b.product?.is_cold_storage ? 1 : 0;
        if (coldA !== coldB) return coldB - coldA;

        const hadA = a.product?.is_high_alert ? 1 : 0;
        const hadB = b.product?.is_high_alert ? 1 : 0;
        if (hadA !== hadB) return hadB - hadA;

        const nameA = a.product?.generic_name || '';
        const nameB = b.product?.generic_name || '';
        return nameA.localeCompare(nameB);
      });

      const newItems: ReceiveItem[] = sortedItems.map((it: RequisitionItem) => ({
        id: crypto.randomUUID(),
        requisition_item_id: it.id,
        product: {
          id: it.product.id,
          generic_name: it.product.generic_name,
          drug_code: it.product.drug_code,
          pack_size: it.product.pack_size,
          unit_price: it.product.unit_price,
          unit_id: it.product.unit_id,
          master_dosage_forms: it.product.master_dosage_forms
        },
        lot_number: '',
        expiry_date: '',
        qty: it.qty,
        pack_size: it.product.pack_size || 1,
        unit_name: it.product.unit_id?.name || '',
        unit_price: (it.product.unit_price ?? '') as number | '',
        remark: ''
      }));
      setItems(newItems);
    }
    setIsReqModalOpen(false);
  };

  const clearRequisitionRef = () => {
    setSelectedRequisitionId(null);
    setSelectedRequisitionData(null);
    setRefDocNo('');
    setRefDocDate('');
  };

  // --- Import Functions ---
  const parseExcelDate = (val: unknown) => {
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
    const wsData = [
      ['drug_code', 'qty', 'lot_number', 'expiry_date', 'unit_price', 'remark'],
      ['1000001', 100, 'L24001', '2026-12-31', 15.50, 'หมายเหตุ (ถ้ามี)']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReceiveItems');
    XLSX.writeFile(wb, 'RKHSTOCK_Receive_Import_Template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStep('processing');
    setImportError('');
    
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      
      if (jsonData.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์');
      
      const parsedItems: ReceiveItem[] = [];
      for (const row of jsonData) {
        if (!row.drug_code) continue;
        const code = String(row.drug_code).trim();
        
        const { data: pData } = await supabase
          .from('products')
          .select('id, drug_code, generic_name, pack_size, unit_price, unit_id:unit_id(name:unit_name)')
          .eq('is_active', true)
          .eq('drug_code', code)
          .limit(1)
          .single();
          
        parsedItems.push({
          id: crypto.randomUUID(),
          drug_code: code,
          qty: row.qty ? Number(row.qty) : ('' as number | ''),
          lot_number: row.lot_number ? String(row.lot_number) : '',
          expiry_date: parseExcelDate(row.expiry_date),
          unit_price: row.unit_price !== undefined && row.unit_price !== null ? Number(row.unit_price) : ('' as number | ''),
          remark: row.remark ? String(row.remark) : '',
          product: pData ? {
            id: pData.id,
            generic_name: pData.generic_name,
            drug_code: pData.drug_code,
            pack_size: pData.pack_size,
            unit_price: pData.unit_price,
            unit_id: pData.unit_id
          } : null,
          pack_size: pData?.pack_size || 1,
          unit_name: (pData?.unit_id as unknown as { name?: string })?.name || ''
        });
      }
      
      setImportItems(parsedItems);
      setImportStep('preview');
      
    } catch (err: unknown) {
      setImportError((err as Error).message || 'เกิดข้อผิดพลาดในการอ่านไฟล์');
      setImportStep('upload');
    }
    
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleConfirmImport = () => {
    const newItems = importItems.map(it => ({
      id: it.id,
      product: it.product,
      lot_number: it.lot_number,
      expiry_date: it.expiry_date,
      qty: it.qty,
      pack_size: it.pack_size,
      unit_name: it.unit_name,
      unit_price: it.unit_price,
      remark: it.remark
    }));
    
    if (items.length === 1 && !items[0].product && items[0].qty === '') {
      setItems(newItems);
    } else {
      setItems([...items, ...newItems]);
    }
    
    setIsImportModalOpen(false);
    setTimeout(() => { setImportStep('upload'); setImportItems([]); }, 300);
  };

  // เริ่มต้นสแกนด้วยกล้องแท็บเล็ต
  const handleStartScan = (rowId: string) => {
    setActiveScanRowId(rowId);
    setScannerError(null);
  };

  // เล่นเสียงบี๊บยืนยันสแกนสำเร็จแบบไร้ไฟล์ Asset
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      console.error('Audio beep failed:', e);
    }
  };

  // จัดการกล้องถ่ายรูปและสแกนบาร์โค้ด
  useEffect(() => {
    if (!activeScanRowId) return;

    let html5QrcodeScanner: Html5Qrcode | null = null;
    
    const timer = setTimeout(async () => {
      try {
        html5QrcodeScanner = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        setScannerInstance(html5QrcodeScanner);

        await html5QrcodeScanner.start(
          { facingMode: "environment" }, // บังคับใช้งานกล้องหลัง
          {
            fps: 15,
            aspectRatio: 1.777778,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.85;
              return { width: size, height: size * 0.45 }; // สี่เหลี่ยมผืนผ้าเหมาะสำหรับสแกนบาร์โค้ดยา
            },
            videoConstraints: {
              focusMode: "continuous",
              advanced: [{ focusMode: "continuous" }]
            }
          },
          (decodedText) => {
            playScanBeep();
            handleUpdateRow(activeScanRowId, 'lot_number', decodedText);
            
            if (html5QrcodeScanner) {
              html5QrcodeScanner.stop().catch(console.error);
            }
            setActiveScanRowId(null);
            setScannerInstance(null);
          },
          () => {
            // ดักจับและละเว้น error ชั่วขณะระหว่างแพนกล้อง
          }
        );

        // Apply continuous autofocus constraints once stream is active
        const activeScanner = html5QrcodeScanner;
        setTimeout(() => {
          if (activeScanner && activeScanner.isScanning) {
            activeScanner.applyVideoConstraints({
              focusMode: "continuous",
              advanced: [{ focusMode: "continuous" }]
            }).catch((err: any) => console.debug("Apply autofocus constraints failed:", err));
          }
        }, 1000);
      } catch (err: unknown) {
        console.error("Camera init failed:", err);
        setScannerError((err as Error).message || "ไม่สามารถเข้าถึงกล้องถ่ายรูปได้ กรุณาตรวจสอบการอนุญาตสิทธิ์ใช้งานกล้อง");
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(console.error);
      }
    };
  }, [activeScanRowId]);

  // สั่งปิดการสแกนและคืนสิทธิ์ควบคุมกล้องถ่ายรูป
  const handleCloseScan = async () => {
    if (scannerInstance && scannerInstance.isScanning) {
      try {
        await scannerInstance.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setActiveScanRowId(null);
    setScannerInstance(null);
  };

  // เพิ่มแถวใหม่ลงตาราง
  const handleAddRow = () => {
    const newId = crypto.randomUUID();
    setItems(prev => [
      ...prev,
      { id: newId, product: null, lot_number: '', expiry_date: '', qty: '', pack_size: 1, unit_name: '', unit_price: '', remark: '' }
    ]);
    setEditingRowId(newId);
  };

  const handleDuplicateRow = (id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx === -1) return prev;
      const rowToCopy = prev[idx];
      const newRow = { 
        ...rowToCopy, 
        id: crypto.randomUUID(),
        lot_number: '', 
        expiry_date: '', 
        qty: '' as const 
      };
      const newItems = [...prev];
      newItems.splice(idx + 1, 0, newRow);
      
      // Auto-focus the lot number field of the new row after it renders
      setTimeout(() => focusCell(newRow.id, 'lot_number'), 50);
      return newItems;
    });
  };

  // ลบแถวออกจากตาราง
  const handleRemoveRow = (id: string) => {
    if (items.length === 1) {
      // ถ้าเหลือแถวสุดท้าย ให้กดลบเป็นการเคลียร์ข้อมูลในแถวแทนการลบแถว
      setItems([{ id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '', pack_size: 1, unit_name: '', unit_price: '', remark: '' }]);
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ReceiveItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === 'product') {
          const prod = value as any;
          return { 
            ...item, 
            product: prod,
            pack_size: prod?.pack_size || 1,
            unit_name: prod?.unit_id?.name || '',
            unit_price: prod?.unit_price || 0
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
    if (field === 'product') {
      setEditingRowId(null);
      setTimeout(() => focusCell(id, 'qty'), 100);
    }
  };

  // บันทึกใบรับเวชภัณฑ์เข้าคลัง
  const handleSaveVoucher = async () => {
    // กรองเฉพาะแถวที่มีการกรอกข้อมูลครบถ้วน
    const validItems = items.filter(item => item.product && item.lot_number && item.expiry_date && item.qty !== '');
    
    if (validItems.length === 0) {
      alert('กรุณากรอกข้อมูลเวชภัณฑ์, Lot, วันหมดอายุ, ราคา และจำนวน ให้ครบถ้วนอย่างน้อย 1 รายการ');
      return;
    }

    if (!actorId) {
      alert('กรุณาระบุ ผู้รับเวชภัณฑ์ ในข้อมูลส่วนหัว');
      return;
    }
    if (!warehouseId) {
      alert('กรุณาระบุ คลังที่รับเข้า');
      return;
    }

    // Check expiry < 6 months
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    const nearExpiryItems = validItems.filter(item => new Date(item.expiry_date) < sixMonthsFromNow);
    if (nearExpiryItems.length > 0) {
      const names = nearExpiryItems.map(i => i.product?.generic_name).join(', ');
      if (!confirm(`แจ้งเตือน! มีเวชภัณฑ์ที่ใกล้หมดอายุ (น้อยกว่า 6 เดือน): \n\n${names}\n\nคุณต้องการบันทึกการรับเข้าเวชภัณฑ์เหล่านี้ใช่หรือไม่?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบเซสชั่นการล็อกอิน");

      const creator = officers.find(s => s.id === user.id);

      // 1. สร้างหัวใบรับเพียงใบเดียว (1 Movement)
      const { data: movement, error: movError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'RECEIVE',
          doc_date: docDate,
          fiscal_year_id: fiscalYearId || null,
          fiscal_year: fiscalYears.find(f => f.id === fiscalYearId)?.year_name ? Number(fiscalYears.find(f => f.id === fiscalYearId)?.year_name) : null,
          reference_doc_no: refDocNo || null,
          reference_doc_date: refDocDate || null,
          from_warehouse_id: fromWarehouseId || null,
          to_warehouse_id: warehouseId,
          receiver: actorId,
          approver_main_warehouse: approverMainId || null,
          issuer_main_warehouse: issuerMainId || null,
          note: headerNote || null,
          requisition_id: selectedRequisitionId || null,
          created_by: user.id,
          created_by_position: creator?.position || null
        })
        .select('id')
        .single();
      
      if (movError) throw movError;

      // 2. เตรียมรายการเวชภัณฑ์ทั้งหมดและสร้าง Lot ไปพร้อมๆ กัน
      const itemsToInsert = [];
      for (const item of validItems) {
        // ค้นหาหรือสร้าง Lot ก่อน
        const { data: lotId, error: lotError } = await supabase.rpc('find_or_create_lot', {
            p_product_id: item.product!.id,
            p_lot_number: item.lot_number,
            p_expiry_date: item.expiry_date,
            p_unit_price: Number(item.unit_price) || 0
        });
        if (lotError) throw lotError;

        itemsToInsert.push({
          movement_id: movement.id,
          product_id: item.product!.id,
          lot_id: lotId,
          qty: Number(item.qty),
          pack_size: item.pack_size,
          unit_name: item.unit_name,
          unit_price: Number(item.unit_price) || 0,
          remark: item.remark || null
        });

        // 3. เพิ่มสต๊อกเข้า stock_balances (RPC ตัวเก่ายังต้องการตัวแปรเดิมอยู่ ซึ่งมันจะไปอัปเดต lot_id ของมันเอง)
        const { error: rpcError } = await supabase.rpc('add_stock_balance', {
          p_product_id: item.product!.id,
          p_warehouse_id: warehouseId,
          p_lot_number: item.lot_number,
          p_expiry_date: item.expiry_date,
          p_qty: Number(item.qty),
          p_unit_price: Number(item.unit_price) || 0
        });
        if (rpcError) throw rpcError;
      }

      const { error: itemsError } = await supabase
        .from('stock_movement_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 4. ถ้ามาจากการอ้างอิงใบเบิก ให้อัปเดตข้อมูลกลับไป
      if (selectedRequisitionId) {
        // อัปเดตสถานะใบเบิก เป็น COMPLETED
        await supabase.from('requisitions').update({ status: 'COMPLETED' }).eq('id', selectedRequisitionId);
        
        // อัปเดตยอดรับจริงและหมายเหตุรายบรรทัด (รวมกรณี 1 รายการแยกหลาย Lot)
        const reqItemMap = new Map<string, { qty: number, remark: string }>();
        for (const item of validItems) {
          if (item.requisition_item_id) {
            const current = reqItemMap.get(item.requisition_item_id) || { qty: 0, remark: '' };
            current.qty += Number(item.qty);
            if (item.remark) {
               current.remark = current.remark ? `${current.remark}, ${item.remark}` : item.remark;
            }
            reqItemMap.set(item.requisition_item_id, current);
          }
        }
        
        for (const [reqItemId, data] of reqItemMap.entries()) {
          await supabase.from('requisition_items').update({
            received_qty: data.qty,
            receive_remark: data.remark || null
          }).eq('id', reqItemId);
        }
      }

      // สำเร็จ
      setSuccessMsg(`บันทึกใบรับเข้าเวชภัณฑ์สำเร็จ! รวมทั้งหมด ${validItems.length} รายการ`);
      
      // รีเซ็ตฟอร์ม
      setItems([{ id: crypto.randomUUID(), product: null, lot_number: '', expiry_date: '', qty: '', pack_size: 1, unit_name: '', unit_price: '', remark: '' }]);
      setDocDate(new Date().toISOString().split('T')[0]);
      setRefDocNo('');
      setRefDocDate('');
      setHeaderNote('');
      setSelectedRequisitionId(null);
      setSelectedRequisitionData(null);
      setTimeout(() => setSuccessMsg(''), 5000);
      
    } catch (err: unknown) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    navigate,
    items, setItems,
    editingRowId, setEditingRowId,
    officers,
    isSubmitting,
    successMsg,
    docDate, setDocDate,
    fiscalYearId, setFiscalYearId,
    fiscalYears,
    fromWarehouseId, setFromWarehouseId,
    warehouseId, setWarehouseId,
    actorId, setActorId,
    approverMainId, setApproverMainId,
    issuerMainId, setIssuerMainId,
    headerNote, setHeaderNote,
    refDocNo, setRefDocNo,
    refDocDate, setRefDocDate,
    selectedRequisitionId,
    selectedRequisitionData,
    isReqDetailModalOpen, setIsReqDetailModalOpen,
    isImportModalOpen, setIsImportModalOpen,
    isRelationalImportOpen, setIsRelationalImportOpen,
    importStep, setImportStep,
    importError,
    importItems,
    importFileRef,
    warehouses,
    isReqModalOpen, setIsReqModalOpen,
    pendingRequisitions,
    isFetchingReqs,
    activeScanRowId,
    scannerError,
    isHelpOpen, setIsHelpOpen,
    setCellRef,
    handleCellKeyDown,
    focusCell,
    fetchPendingRequisitions,
    loadRequisition,
    clearRequisitionRef,
    handleDownloadTemplate,
    handleFileUpload,
    handleConfirmImport,
    handleStartScan,
    handleCloseScan,
    handleAddRow,
    handleDuplicateRow,
    handleRemoveRow,
    handleUpdateRow,
    handleSaveVoucher
  };

}
