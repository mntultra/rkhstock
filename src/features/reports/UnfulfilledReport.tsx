import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { 
  Calendar, 
  Filter, 
  Printer, 
  Search, 
  FileX, 
  Download, 
  Package, 
  CheckCircle2, 
  AlertTriangle,
  ClipboardList,
  Layers,
  Table as TableIcon,
  User,
  FileText,
  Clock,
  Pill,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import * as XLSX from 'xlsx';

interface UnfulfilledItem {
  requisition_doc_no: string;
  requisition_date: string;
  requester_name: string;
  drug_code: string;
  generic_name: string;
  dosage_form: string;
  requested_qty: number;
  received_qty: number;
  missing_qty: number;
  unit_name: string;
  remark: string;
  status: string;
}

interface GroupedRequisition {
  doc_no: string;
  doc_date: string;
  requester_name: string;
  status: string;
  total_requested: number;
  total_received: number;
  total_missing: number;
  items: UnfulfilledItem[];
}

export default function UnfulfilledReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [selectedDocNo, setSelectedDocNo] = useState<string>('ALL');
  const [selectedDrug, setSelectedDrug] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const [items, setItems] = useState<UnfulfilledItem[]>([]);
  const [totalAllReqItems, setTotalAllReqItems] = useState(0);
  const [totalAllRequisitions, setTotalAllRequisitions] = useState(0);
  const [totalAllReqQty, setTotalAllReqQty] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReport = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // 1. ดึงข้อมูลใบเบิกที่ PENDING, PARTIAL, COMPLETED ภายในช่วงเวลา (ไม่รวม DRAFT และ REJECTED)
      let query = supabase
        .from('requisitions')
        .select(`
          id, doc_no, doc_date, status,
          requester:officers!requester_id(full_name),
          items:requisition_items(
            id, qty, received_qty, remarks, unit_name,
            product:products(id, drug_code, generic_name, master_dosage_forms(name_en, abbreviation), master_units(name:unit_name))
          )
        `)
        .gte('doc_date', startDate)
        .lte('doc_date', endDate)
        .neq('status', 'DRAFT')
        .neq('status', 'REJECTED')
        .order('doc_date', { ascending: false });

      if (statusFilter === 'COMPLETED') {
        query = query.in('status', ['COMPLETED', 'PARTIAL']);
      } else if (statusFilter === 'PENDING') {
        query = query.eq('status', 'PENDING');
      }

      const { data: requisitions, error: reqError } = await query;
      if (reqError) throw reqError;

      const reqList = requisitions || [];
      const reqIds = reqList.map(r => r.id);
      const docNos = reqList.map(r => r.doc_no).filter(Boolean);

      // 2. ดึงข้อมูลการรับจริงจาก stock_movements ที่ผูกกับใบเบิกเหล่านี้ (ทั้งทาง requisition_id และ reference_doc_no)
      const movementQtyMap = new Map<string, number>();
      const reqWithMovements = new Set<string>();

      if (reqIds.length > 0 || docNos.length > 0) {
        let movQuery = supabase
          .from('stock_movements')
          .select(`
            id,
            requisition_id,
            reference_doc_no,
            movement_type,
            is_voided,
            stock_movement_items(product_id, qty)
          `)
          .eq('movement_type', 'RECEIVE')
          .neq('is_voided', true);

        if (reqIds.length > 0) {
          movQuery = movQuery.or(`requisition_id.in.(${reqIds.join(',')}),reference_doc_no.in.(${docNos.map(d => `"${d}"`).join(',')})`);
        }

        const { data: movements, error: movError } = await movQuery;

        if (!movError && movements) {
          movements.forEach((m: any) => {
            const reqId = m.requisition_id;
            const refDoc = m.reference_doc_no;
            if (reqId) reqWithMovements.add(reqId);

            if (m.stock_movement_items) {
              m.stock_movement_items.forEach((smi: any) => {
                if (reqId) {
                  const key = `${reqId}_${smi.product_id}`;
                  movementQtyMap.set(key, (movementQtyMap.get(key) || 0) + (Number(smi.qty) || 0));
                }
                if (refDoc) {
                  const docKey = `${refDoc}_${smi.product_id}`;
                  movementQtyMap.set(docKey, (movementQtyMap.get(docKey) || 0) + (Number(smi.qty) || 0));
                }
              });
            }
          });
        }
      }

      const results: UnfulfilledItem[] = [];

      for (const req of reqList) {
        const totalItemsRecQty = (req.items || []).reduce((sum: number, it: any) => sum + (Number(it.received_qty) || 0), 0);
        const hasMovements = reqWithMovements.has(req.id) || (req.doc_no && Array.from(movementQtyMap.keys()).some(k => k.startsWith(req.doc_no)));

        // กรณีเป็นใบเบิกประวัติศาสตร์ COMPLETED ที่ไม่มียอด received_qty และไม่มี stock_movement (นำเข้าเป็น Completed ล้วน)
        // จะถือว่าได้รับครบทั้งหมด (ไม่นำมาแสดงเป็นยอดค้างจ่าย)
        const isHistoricalFullyCompleted = req.status === 'COMPLETED' && totalItemsRecQty === 0 && !hasMovements;

        for (const item of (req.items || [])) {
          const reqQty = Number(item.qty) || 0;
          const prodId = (item.product as any)?.id;
          const movKey = `${req.id}_${prodId}`;
          const docKey = req.doc_no ? `${req.doc_no}_${prodId}` : '';
          const movementRecQty = movementQtyMap.get(movKey) ?? (docKey ? movementQtyMap.get(docKey) : undefined);

          let recQty = 0;
          if (isHistoricalFullyCompleted) {
            recQty = reqQty;
          } else if (movementRecQty !== undefined) {
            recQty = movementRecQty;
          } else {
            recQty = Number(item.received_qty) || 0;
          }

          const missing = Math.max(0, reqQty - recQty);

          // ถ้ายอดขาดหายมากกว่า 0 ถือว่าค้างจ่าย/ไม่ได้ของ
          if (missing > 0) {
            results.push({
              requisition_doc_no: req.doc_no,
              requisition_date: req.doc_date,
              requester_name: (req.requester as any)?.full_name || 'ไม่ระบุ',
              drug_code: (item.product as any)?.drug_code || '',
              generic_name: (item.product as any)?.generic_name || '',
              dosage_form: (item.product as any)?.master_dosage_forms?.abbreviation || (item.product as any)?.master_dosage_forms?.name_en || '-',
              requested_qty: reqQty,
              received_qty: recQty,
              missing_qty: missing,
              unit_name: item.unit_name || (item.product as any)?.master_units?.name || (item.product as any)?.master_units?.unit_name || '',
              remark: item.remarks || '-',
              status: req.status
            });
          }
        }
      }

      // คำนวณจำนวนรายการขอเบิกทั้งหมดในช่วงเวลา
      let allItemsCount = 0;
      let allReqQtySum = 0;
      for (const req of reqList) {
        for (const item of (req.items || [])) {
          allItemsCount++;
          allReqQtySum += (Number(item.qty) || 0);
        }
      }

      setTotalAllRequisitions(reqList.length);
      setTotalAllReqItems(allItemsCount);
      setTotalAllReqQty(allReqQtySum);
      setItems(results);
    } catch (err: any) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, statusFilter]);

  // ตัวเลือกสำหรับ Filter รายการใบเบิกและรายการยา
  const availableDocNos = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => { if (it.requisition_doc_no) set.add(it.requisition_doc_no); });
    return Array.from(set).sort();
  }, [items]);

  const availableDrugs = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(it => {
      if (it.drug_code && it.generic_name) {
        map.set(it.drug_code, `${it.generic_name} [${it.drug_code}]`);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  // กรองข้อมูลตาม Filter ทั้งหมด
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      // Filter ใบเบิก
      if (selectedDocNo !== 'ALL' && it.requisition_doc_no !== selectedDocNo) return false;
      
      // Filter ยา
      if (selectedDrug !== 'ALL' && it.drug_code !== selectedDrug) return false;

      // Filter ค้นหา
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = it.generic_name.toLowerCase().includes(q);
        const matchDoc = it.requisition_doc_no.toLowerCase().includes(q);
        const matchCode = it.drug_code.toLowerCase().includes(q);
        const matchRequester = it.requester_name.toLowerCase().includes(q);
        if (!matchName && !matchDoc && !matchCode && !matchRequester) return false;
      }

      return true;
    });
  }, [items, selectedDocNo, selectedDrug, searchQuery]);

  // จัดกลุ่มตามใบเบิก
  const groupedRequisitions: GroupedRequisition[] = useMemo(() => {
    const map = new Map<string, GroupedRequisition>();
    
    for (const item of filteredItems) {
      const docKey = item.requisition_doc_no || 'ไม่ระบุเลขที่';
      if (!map.has(docKey)) {
        map.set(docKey, {
          doc_no: item.requisition_doc_no,
          doc_date: item.requisition_date,
          requester_name: item.requester_name,
          status: item.status,
          total_requested: 0,
          total_received: 0,
          total_missing: 0,
          items: []
        });
      }
      
      const group = map.get(docKey)!;
      group.total_requested += item.requested_qty;
      group.total_received += item.received_qty;
      group.total_missing += item.missing_qty;
      group.items.push(item);
    }

    return Array.from(map.values());
  }, [filteredItems]);

  // สรุปยอดรวม
  const totalRequested = filteredItems.reduce((sum, it) => sum + it.requested_qty, 0);
  const totalReceived = filteredItems.reduce((sum, it) => sum + it.received_qty, 0);
  const totalMissing = filteredItems.reduce((sum, it) => sum + it.missing_qty, 0);

  const toggleGroupCollapse = (docNo: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [docNo]: !prev[docNo]
    }));
  };

  // ฟังก์ชัน Export เป็น Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const exportData = filteredItems.map((item, idx) => ({
      'ลำดับ': idx + 1,
      'วันที่เบิก': formatDate(item.requisition_date),
      'เลขที่ใบเบิก': item.requisition_doc_no,
      'ผู้เบิก': item.requester_name,
      'รหัสยา': item.drug_code,
      'ชื่อเวชภัณฑ์': item.generic_name,
      'รูปแบบ': item.dosage_form,
      'จำนวนเบิก': item.requested_qty,
      'ได้รับจริง': item.received_qty,
      'ยอดค้างจ่าย/ไม่ได้ของ': item.missing_qty,
      'หน่วย': item.unit_name,
      'สถานะใบเบิก': item.status === 'COMPLETED' ? 'เสร็จสิ้น' : item.status === 'PARTIAL' ? 'รับบางส่วน' : 'รอรับ',
      'หมายเหตุ': item.remark
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายการค้างจ่าย');
    XLSX.writeFile(wb, `รายงานรายการค้างจ่าย_${startDate}_ถึง_${endDate}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'COMPLETED') {
      return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">เสร็จสิ้น</span>;
    } else if (status === 'PARTIAL') {
      return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">รับบางส่วน</span>;
    } else {
      return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">รอรับ</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <FileX size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">รายงานรายการค้างจ่าย / ไม่ได้ของ</h1>
              <p className="text-sm text-gray-500 font-medium mt-1">
                แสดงรายการเวชภัณฑ์ที่ขอเบิกไป แต่คลังหลักจ่ายให้ไม่ครบ หรือไม่จ่ายให้เลย (จำนวนเป็น 0)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grouped' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers size={14} /> จัดกลุ่มตามใบเบิก
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'flat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TableIcon size={14} /> ตารางรวม
              </button>
            </div>

            <Button onClick={handleExportExcel} variant="secondary" icon={<Download size={16} />}>
              ส่งออก Excel
            </Button>
            <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700" icon={<Printer size={16} />}>
              พิมพ์รายงาน
            </Button>
          </div>
        </div>

        {/* Summary Metric Cards (Dynamic according to filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 print:grid-cols-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2 text-slate-600 text-xs font-bold uppercase mb-1">
              <Package size={16} className="text-slate-500" /> จำนวนรายการค้างจ่าย
            </div>
            <div className="text-2xl font-black text-slate-800">
              {filteredItems.length.toLocaleString()} <span className="text-xs font-semibold text-slate-500">รายการ</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              จาก {groupedRequisitions.length.toLocaleString()} ใบเบิกที่ตรงตามตัวกรอง
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase mb-1">
              <Calendar size={16} className="text-blue-500" /> รวมจำนวนขอเบิก
            </div>
            <div className="text-2xl font-black text-blue-700">
              {totalRequested.toLocaleString()} <span className="text-xs font-semibold text-blue-600">หน่วย</span>
            </div>
            <div className="text-[11px] font-bold text-blue-400 mt-0.5">
              ยอดขอเบิกตามตัวกรอง
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase mb-1">
              <CheckCircle2 size={16} className="text-emerald-500" /> รวมจำนวนได้รับจริง
            </div>
            <div className="text-2xl font-black text-emerald-700">
              {totalReceived.toLocaleString()} <span className="text-xs font-semibold text-emerald-600">หน่วย</span>
            </div>
            <div className="text-[11px] font-bold text-emerald-400 mt-0.5">
              ยอดที่ตรวจรับเข้าคลังแล้ว
            </div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2 text-red-700 text-xs font-bold uppercase mb-1">
              <AlertTriangle size={16} className="text-red-500" /> รวมยอดค้างจ่าย / ขาด
            </div>
            <div className="text-2xl font-black text-red-600">
              {totalMissing.toLocaleString()} <span className="text-xs font-semibold text-red-600">หน่วย</span>
            </div>
            <div className="text-[11px] font-bold text-red-400 mt-0.5">
              ยอดขาดส่งตามตัวกรอง
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5 p-4 bg-gray-50 rounded-2xl mb-6 print:hidden border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ตั้งแต่วันที่</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <DatePicker value={startDate} onChange={setStartDate} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ถึงวันที่</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <DatePicker value={endDate} onChange={setEndDate} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">สถานะใบเบิก</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">ทุกสถานะ (All)</option>
              <option value="COMPLETED">รับแล้วแต่ได้ไม่ครบ</option>
              <option value="PENDING">รอรับของ (Pending)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">กรองตามเลขใบเบิก</label>
            <select 
              value={selectedDocNo} 
              onChange={(e) => setSelectedDocNo(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">ทุกใบเบิก ({availableDocNos.length})</option>
              {availableDocNos.map(doc => (
                <option key={doc} value={doc}>{doc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">กรองเฉพาะรายการยา</label>
            <select 
              value={selectedDrug} 
              onChange={(e) => setSelectedDrug(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">ทุกรายการยา ({availableDrugs.length})</option>
              {availableDrugs.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ค้นหาด่วน</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="ชื่อยา, รหัส, ผู้เบิก..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm font-bold">{error}</div>}

        {/* Content Body */}
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 font-bold border border-gray-200 rounded-2xl">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              กำลังโหลดข้อมูล...
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-gray-400 font-bold border border-gray-200 rounded-2xl">
            <div className="flex flex-col items-center justify-center gap-2">
              <Filter size={36} className="text-gray-300" />
              <p className="text-base text-gray-500">ไม่มีรายการค้างจ่ายในช่วงเวลาหรือเงื่อนไขที่เลือก</p>
            </div>
          </div>
        ) : viewMode === 'grouped' ? (
          /* ================= GROUPED VIEW ================= */
          <div className="space-y-4">
            {groupedRequisitions.map((group) => {
              const isCollapsed = collapsedGroups[group.doc_no];
              return (
                <div key={group.doc_no} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:border-gray-300">
                  {/* Requisition Group Header */}
                  <div 
                    onClick={() => toggleGroupCollapse(group.doc_no)}
                    className="p-4 bg-slate-50/80 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-gray-400 hover:text-gray-600 p-1">
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-indigo-700 text-base">{group.doc_no}</span>
                          {getStatusBadge(group.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-gray-400" /> วันที่เบิก: <strong>{formatDate(group.doc_date)}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={13} className="text-gray-400" /> ผู้เบิก: <strong>{group.requester_name}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Group Badges Summary */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">
                        {group.items.length} รายการ
                      </span>
                      <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs font-black">
                        ค้างจ่ายรวม {group.total_missing.toLocaleString()} หน่วย
                      </span>
                    </div>
                  </div>

                  {/* Items Sub-table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/60 text-xs font-extrabold text-gray-500 border-b border-gray-100 uppercase">
                          <tr>
                            <th className="px-4 py-2.5 w-12 text-center">#</th>
                            <th className="px-4 py-2.5">รหัสยา</th>
                            <th className="px-4 py-2.5">เวชภัณฑ์ (รูปแบบ)</th>
                            <th className="px-4 py-2.5 text-right w-28">จำนวนเบิก</th>
                            <th className="px-4 py-2.5 text-right w-28">ได้รับจริง</th>
                            <th className="px-4 py-2.5 text-right w-32 bg-red-50/40 text-red-600 font-black">ยอดค้างจ่าย</th>
                            <th className="px-4 py-2.5 w-24">หน่วย</th>
                            <th className="px-4 py-2.5">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                              <td className="px-4 py-3 text-center text-xs font-bold text-gray-400">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-emerald-600 text-xs">
                                [{item.drug_code}]
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-extrabold text-gray-900">{item.generic_name}</div>
                                <div className="text-[11px] text-gray-400 font-semibold mt-0.5">
                                  รูปแบบ: <span className="text-gray-600">{item.dosage_form}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-600">
                                {item.requested_qty.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                {item.received_qty.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-red-600 bg-red-50/30">
                                {item.missing_qty.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-gray-500">
                                {item.unit_name}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 italic max-w-xs truncate">
                                {item.remark !== '-' ? item.remark : <span className="text-gray-300">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= FLAT TABLE VIEW ================= */
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-100/80 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-extrabold text-gray-600">วันที่เบิก</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600">เลขที่ใบเบิก</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600">ผู้เบิก</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600">เวชภัณฑ์ (รูปแบบ)</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600 text-right">จำนวนเบิก</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600 text-right">ได้รับจริง</th>
                  <th className="px-4 py-3 font-extrabold text-red-600 text-right bg-red-50/50">ยอดค้างจ่าย</th>
                  <th className="px-4 py-3 font-extrabold text-gray-600 text-center">สถานะใบเบิก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-gray-600 font-medium">
                      {formatDate(item.requisition_date)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {item.requisition_doc_no}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {item.requester_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-gray-900">{item.generic_name}</div>
                      <div className="text-[11px] text-gray-500 font-bold mt-0.5 flex gap-2">
                        <span className="text-emerald-600">[{item.drug_code}]</span>
                        <span className="bg-gray-100 px-1.5 rounded">{item.dosage_form}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-600">
                      {item.requested_qty.toLocaleString()} <span className="text-xs font-medium text-gray-400">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {item.received_qty.toLocaleString()} <span className="text-xs font-medium text-emerald-400">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600 bg-red-50/30 group-hover:bg-red-50/80 transition-colors">
                      {item.missing_qty.toLocaleString()} <span className="text-xs font-bold text-red-500">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


