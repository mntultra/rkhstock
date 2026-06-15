import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductSearchResult } from '@/types';
import { useOfficers } from '@/hooks/useOfficers';
import { useWarehouses } from '@/hooks/useWarehouses';
import ProductSearchInput from '@/components/ProductSearchInput';
import { ArrowDownToLine, Plus, Trash2, Save, Camera, X, AlertCircle, FileText, ChevronDown, Search, Keyboard, Upload, FileSpreadsheet, Download, ExternalLink, Copy, Database, History } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import ReceiveRelationalImportModal from './ReceiveRelationalImportModal';

// ─── Custom Officer Dropdown ─────────────────────────────────────────────────────
function CustomOfficerSelect({ value, onChange, officers, placeholder = '-- เลือกเจ้าหน้าที่ --' }: {
  value: string; onChange: (v: string) => void; officers: { id: string; full_name: string; position?: string }[]; placeholder?: string;
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
import { useReceiveForm } from './hooks/useReceiveForm';

export default function ReceiveForm() {
  const {
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
  } = useReceiveForm();

  return (
    <div className="max-w-full mx-auto space-y-6">
      
      {successMsg && (
        <Alert type="success" message={successMsg} />
      )}

      {/* Header Card — รวม Title + ข้อมูลหัวทั้งหมด */}
      <Card className="space-y-5 animate-fade-in-up">
        {/* Title Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
              <ArrowDownToLine size={28} />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">รับเวชภัณฑ์เข้า (Receive Supplies)</h1>
              </div>
              <p className="text-gray-400 text-sm font-medium mt-0.5">บันทึกการรับเวชภัณฑ์เข้าคลัง (Receive Medical Supplies)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <Button
              variant="outline"
              onClick={() => navigate('/reports/movements?type=RECEIVE')}
              icon={<History size={18} />}
            >
              ประวัติการรับ
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIsReqModalOpen(true); fetchPendingRequisitions(); }}
              icon={<FileText size={18} />}
            >
              อ้างอิงจากใบเบิก
            </Button>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold border border-emerald-100">
              <FileSpreadsheet size={20} />
              <span>ใบรับเวชภัณฑ์</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Row 1: วันที่รับ | เลขที่ใบรับ | ปีงบประมาณ | รับจาก | รับเข้าคลัง */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">เลขที่ใบรับ</label>
            <input
              type="text"
              value={`REC${docDate.replace(/-/g, '')}-XX`}
              disabled
              className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 font-mono select-none"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">วันที่รับ <span className="text-red-500">*</span></label>
            <DatePicker value={docDate} onChange={setDocDate} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">ปีงบประมาณ <span className="text-red-500">*</span></label>
            <select
              value={fiscalYearId}
              onChange={e => setFiscalYearId(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
            >
              {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.year_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">รับจาก <span className="text-red-500">*</span></label>
            <select
              value={fromWarehouseId}
              onChange={e => setFromWarehouseId(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
            >
              <option value="">-- เลือกคลังต้นทาง --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">รับเข้าคลัง <span className="text-red-500">*</span></label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium"
            >
              <option value="">-- เลือกคลังปลายทาง --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: เลขที่อ้างอิง | ลงวันที่อ้างอิง | หมายเหตุ | เลขที่ใบเบิก (Readonly) | วันที่ใบเบิก (Readonly) */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 mt-5">
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">เลขที่เอกสารอ้างอิง (ใบจ่าย/ใบนำส่ง)</label>
            <input type="text" value={refDocNo} onChange={e => setRefDocNo(e.target.value)}
              placeholder="เช่น ใบจ่ายเลขที่ ISS-XXX..."
              className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">ลงวันที่เอกสารอ้างอิง</label>
            <DatePicker value={refDocDate} onChange={setRefDocDate} className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">หมายเหตุ (Note)</label>
            <input type="text" value={headerNote} onChange={e => setHeaderNote(e.target.value)}
              placeholder="หมายเหตุระดับเอกสาร..."
              className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-sm font-medium" />
          </div>
          
          {/* ส่วนแสดงข้อมูลใบเบิกที่อ้างอิง (อ่านอย่างเดียว) */}
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">เลขที่ใบเบิกอ้างอิง</label>
            <input
              type="text"
              value={selectedRequisitionData?.doc_no || '-'}
              disabled
              className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 font-mono select-none"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">วันที่ใบเบิกอ้างอิง</label>
            <input
              type="text"
              value={selectedRequisitionData?.doc_date ? formatDate(selectedRequisitionData.doc_date) : '-'}
              disabled
              className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 select-none"
            />
          </div>
        </div>

        {/* Row 3: เจ้าหน้าที่ 3 คน */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-dashed border-gray-200">
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              ผู้อนุมัติจ่ายเวชภัณฑ์ (Main Warehouse Approver)
            </label>
            <CustomOfficerSelect value={approverMainId} onChange={setApproverMainId} officers={officers} placeholder="-- เลือกผู้อนุมัติจ่าย --" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              ผู้จ่ายเวชภัณฑ์ (Main Warehouse Issuer)
            </label>
            <CustomOfficerSelect value={issuerMainId} onChange={setIssuerMainId} officers={officers} placeholder="-- เลือกผู้จ่าย --" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1.5">
              ผู้รับเวชภัณฑ์ (Receiver) <span className="text-red-500">*</span>
            </label>
            <CustomOfficerSelect value={actorId} onChange={setActorId} officers={officers} placeholder="-- เลือกผู้รับ --" />
          </div>
        </div>

        {/* Requisition Reference Banner */}
        {selectedRequisitionId && selectedRequisitionData && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <FileText size={18} className="text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-extrabold text-blue-800 text-sm">อ้างอิงใบเบิก:</span>
              <span className="ml-2 font-mono font-bold text-blue-700 text-sm">{selectedRequisitionData.doc_no}</span>
              <span className="ml-3 text-blue-600 text-xs">
                วันที่: {formatDate(selectedRequisitionData.doc_date)}
              </span>
              {selectedRequisitionData.requester?.full_name && (
                <span className="ml-3 text-blue-500 text-xs">ผู้เบิก: {selectedRequisitionData.requester.full_name}</span>
              )}
            </div>
            <button type="button" onClick={() => setIsReqDetailModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 rounded-lg transition-colors shrink-0">
              <ExternalLink size={13} />
              ดูรายละเอียด
            </button>
            <button type="button" onClick={clearRequisitionRef}
              className="p-1.5 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              title="ยกเลิกการอ้างอิงใบเบิก">
              <X size={14} />
            </button>
          </div>
        )}
      </Card>

      {/* ตารางรับเวชภัณฑ์แบบแถวตาราง */}
      <Card className="shadow-xl shadow-emerald-900/5 space-y-4 overflow-visible animate-fade-in-up animation-delay-2000">
        
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-extrabold text-emerald-800 flex items-center gap-2">
            <FileSpreadsheet size={18} /> รายการเวชภัณฑ์ที่รับเข้า
          </h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors text-xs font-bold shadow-sm">
              <Upload size={14} /> นำเข้าตารางหน้าเว็บ
            </button>
            <button type="button" onClick={() => setIsRelationalImportOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors text-xs font-bold shadow-sm">
              <Database size={14} /> นำเข้าประวัติย้อนหลัง (Bulk)
            </button>
          </div>
        </div>

        <div className="min-h-[350px] overflow-visible">
          <table className="w-full text-left border-collapse text-sm overflow-visible">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider">
                <th className="py-3 px-2 w-10 text-center">#</th>
                <th className="py-3 px-3 w-[26%]">
                  <div className="flex items-center gap-2">
                    ค้นหาเวชภัณฑ์ (Product Search)
                  </div>
                </th>
                <th className="py-3 px-3 w-[10%] text-center">รูปแบบ (Dosage Form)</th>
                <th className="py-3 px-3 w-[12%] text-right">จำนวนรับ (Received Qty)</th>
                <th className="py-3 px-3 w-[11%]">เลขล็อต (Lot No)</th>
                <th className="py-3 px-3 w-[12%]">วันหมดอายุ (EXP Date)</th>
                <th className="py-3 px-3 w-[8%] text-right">ราคา/หน่วย (Unit Price)</th>
                <th className="py-3 px-3 w-[10%]">หมายเหตุ (Remarks)</th>
                <th className="py-3 px-3 w-10 text-center">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 overflow-visible">
              {items.map((item, index) => (
                <tr key={item.id} className={`${item.qty === 0 ? 'bg-red-50/70 hover:bg-red-100/70 border-l-4 border-l-red-500' : 'hover:bg-gray-50/50'} transition-colors overflow-visible group`}>
                  {/* ลำดับที่ */}
                  <td className="py-4 px-2 text-center font-bold text-gray-400">
                    {index + 1}
                  </td>
                  
                  {/* ค้นหายา */}
                  <td className="py-4 px-3 overflow-visible relative">
                    {item.product && editingRowId !== item.id ? (
                      <div className="flex items-center gap-1.5">
                        <div 
                          onClick={() => setEditingRowId(item.id)}
                          className="flex-1 flex items-start justify-between p-2.5 border-2 border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-500 rounded-xl shadow-inner transition-all group/item cursor-pointer min-w-0"
                          title="คลิกเพื่อเปลี่ยนเวชภัณฑ์"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-gray-900 leading-tight">
                              {item.product.generic_name} {item.product.trade_name && <span className="text-gray-500 font-bold ml-1 text-[10px]">({item.product.trade_name})</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-[9px] font-bold text-gray-500 mt-1.5">
                              {item.product.drug_code && (
                                <span className="font-mono font-extrabold text-indigo-800 text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded select-none">
                                  {item.product.drug_code}
                                </span>
                              )}
                              {item.product.is_cold_storage && (
                                <span className="bg-cyan-100 px-1.5 py-0.5 rounded text-cyan-700 border border-cyan-200">
                                  COLD
                                </span>
                              )}
                              {item.product.is_high_alert && (
                                <span className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-700 border border-amber-200">
                                  HAD
                                </span>
                              )}
                              {item.product.is_psycho_narco && (
                                <span className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-700 border border-rose-200">
                                  PSYCO
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 text-emerald-400 group-hover/item:text-emerald-600 transition-colors p-1.5 rounded-full group-hover/item:bg-white text-sm font-extrabold shrink-0">
                            <Search size={16} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartScan(item.id)}
                          className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                          title="สแกน Barcode/QR"
                        >
                          <Camera size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative z-50 flex gap-1.5 items-center">
                        <div className="flex-1 min-w-0">
                          <ProductSearchInput 
                            onSelect={(prod) => handleUpdateRow(item.id, 'product', prod)}
                            onClickOutside={() => setEditingRowId(null)}
                            placeholder={item.product ? "ค้นหายาเพื่อเปลี่ยน..." : "พิมพ์ชื่อสามัญ (Generic), รหัส, หรือ Trade Name..."}
                            autoFocus={editingRowId === item.id}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartScan(item.id)}
                          className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                          title="สแกน Barcode/QR เพื่อบันทึกเข้า Lot Number"
                        >
                          <Camera size={16} />
                        </button>
                      </div>
                    )}
                  </td>

                  {/* รูปแบบยา (Dosage Form) */}
                  <td className="py-4 px-3 text-center">
                    {item.product && (item.product as any).master_dosage_forms ? (
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                        {(item.product as any).master_dosage_forms.abbreviation || (item.product as any).master_dosage_forms.name_en || '-'}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>

                  {/* จำนวน */}
                  <td className="py-4 px-3 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <input 
                        ref={setCellRef(item.id, 'qty')}
                        type="number" 
                        min="0" 
                        required 
                        value={item.qty} 
                        onChange={e => handleUpdateRow(item.id, 'qty', e.target.value === '' ? '' : parseInt(e.target.value))}
                        onKeyDown={e => handleCellKeyDown(e, item.id, 'qty')}
                        placeholder="0"
                        className={`w-20 px-2.5 py-2.5 bg-white/70 backdrop-blur-sm border rounded-xl focus:ring-4 outline-none transition-all text-sm font-extrabold text-center shadow-sm ${item.qty === 0 ? 'border-red-300 focus:ring-red-100 focus:border-red-500 text-red-600' : 'border-emerald-100 focus:ring-emerald-100 focus:border-emerald-500 text-emerald-700'}`}
                      />
                      {item.product && (
                        <span className="font-bold text-slate-500 text-sm whitespace-nowrap ml-1.5">
                          {item.pack_size && item.pack_size !== 1 ? `x ${item.pack_size} ` : ''}{item.unit_name || 'ชิ้น'}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Lot Number */}
                  <td className="py-4 px-3">
                    <input 
                      ref={setCellRef(item.id, 'lot_number')}
                      type="text" 
                      required 
                      value={item.lot_number} 
                      onChange={e => handleUpdateRow(item.id, 'lot_number', e.target.value)}
                      onKeyDown={e => handleCellKeyDown(e, item.id, 'lot_number')}
                      placeholder="เช่น L24001"
                      className="w-full px-3 py-2.5 bg-white/70 backdrop-blur-sm border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-mono text-sm shadow-sm"
                    />
                  </td>
                  
                  {/* วันหมดอายุ */}
                  <td className="py-4 px-3">
                    <DatePicker 
                      ref={setCellRef(item.id, 'expiry_date')}
                      value={item.expiry_date} 
                      onChange={value => handleUpdateRow(item.id, 'expiry_date', value)}
                      onKeyDown={e => handleCellKeyDown(e as any, item.id, 'expiry_date')}
                      className="w-full px-3 py-2.5 bg-white/70 backdrop-blur-sm border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                    />
                  </td>
                  
                  {/* ราคาต่อหน่วย */}
                  <td className="py-4 px-3 text-right">
                    <input 
                      ref={setCellRef(item.id, 'unit_price')}
                      type="number" 
                      min="0"
                      step="0.01" 
                      required 
                      value={item.unit_price} 
                      onChange={e => handleUpdateRow(item.id, 'unit_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      onKeyDown={e => handleCellKeyDown(e, item.id, 'unit_price')}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 bg-white/70 backdrop-blur-sm border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm text-right"
                    />
                  </td>

                  {/* หมายเหตุ */}
                  <td className="py-4 px-3">
                    <input 
                      ref={setCellRef(item.id, 'remark')}
                      type="text" 
                      value={item.remark || ''} 
                      onChange={e => handleUpdateRow(item.id, 'remark', e.target.value)}
                      onKeyDown={e => handleCellKeyDown(e, item.id, 'remark')}
                      placeholder="เช่น ขาดส่ง"
                      className="w-full px-3 py-2.5 bg-white/70 backdrop-blur-sm border border-emerald-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm shadow-sm"
                    />
                  </td>
                  
                  {/* จัดการแถว (แยก Lot / ลบแถว) */}
                  <td className="py-4 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => handleDuplicateRow(item.id)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="แยก Lot (คัดลอกรายการนี้เพิ่ม)"
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        onClick={() => handleRemoveRow(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบแถวนี้"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ปุ่มควบคุมแถวและบันทึกใบรับ */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddRow}
              icon={<Plus size={18} />}
            >
              เพิ่มแถวยาใหม่
            </Button>
            {/* Keyboard shortcut help button */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              title="คู่มือทางลัดคีย์บอร์ด (Alt+H)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 hover:border-emerald-300 rounded-lg transition-all select-none group"
            >
              <Keyboard size={13} className="group-hover:text-emerald-600 transition-colors" />
              <span>คู่มือทางลัด</span>
              <span className="px-1 py-0.5 bg-gray-200/80 group-hover:bg-emerald-100 group-hover:text-emerald-700 rounded text-[10px] font-mono transition-colors">Alt+H</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
            <div className="text-right">
              <p className="text-xs text-gray-400 font-extrabold uppercase tracking-wider">จำนวนรับเข้ารวม</p>
              <p className="text-2xl font-extrabold text-gray-800">
                {items.filter(item => item.product).length} <span className="text-sm font-medium text-gray-400">รายการ</span>
              </p>
            </div>
            
            <Button 
              onClick={handleSaveVoucher}
              disabled={isSubmitting || items.length === 0}
              icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
              size="lg"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบรับเวชภัณฑ์นี้'}
            </Button>
          </div>
        </div>

      </Card>

      {/* ================= MODAL: เลือกใบเบิก ================= */}
      {isReqModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsReqModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
          ></div>

          <div className="relative w-full max-w-4xl bg-white border border-emerald-500/30 rounded-3xl p-6 shadow-2xl z-10 animate-fade-in max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">เลือกอ้างอิงจากใบเบิกที่ยังค้างอยู่</h2>
                <p className="text-sm text-gray-500">เลือกใบเบิกเพื่อดึงรายการเวชภัณฑ์มารับเข้าอัตโนมัติ</p>
              </div>
              <button 
                onClick={() => setIsReqModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {isFetchingReqs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                </div>
              ) : pendingRequisitions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <FileText size={48} className="opacity-20" />
                  <p>ไม่พบใบเบิกที่รอดำเนินการ</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingRequisitions.map((req) => (
                    <div 
                      key={req.id} 
                      onClick={() => loadRequisition(req)}
                      className="border border-gray-200 p-4 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-emerald-800 text-lg group-hover:text-emerald-700">{req.doc_no}</span>
                        <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-bold border border-amber-200">
                          {req.status === 'PENDING' ? 'ส่งใบเบิกแล้ว' : req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">วันที่เบิก: {formatDate(req.doc_date)}</p>
                      <p className="text-sm text-gray-600 mb-2">ผู้เบิก: {req.requester?.full_name}</p>
                      
                      <div className="text-xs font-bold text-gray-400 mb-2 border-t pt-2 mt-2">รายการยา: {req.items?.length || 0} รายการ</div>
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {req.items?.map((it: import('./hooks/useReceiveForm').RequisitionItem) => it.product?.generic_name).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= CAMERA SCANNER MODAL ================= */}
      {activeScanRowId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={handleCloseScan}
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
          ></div>

          <div className="relative w-full max-w-md bg-gradient-to-b from-emerald-950 to-neutral-950 border border-emerald-500/30 rounded-3xl p-6 text-white shadow-2xl z-10 animate-fade-in text-center space-y-6">
            <button 
              onClick={handleCloseScan}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 justify-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center border border-emerald-400/30">
                <Camera className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold">สแกนรหัสล็อตสินค้า (Lot Barcode)</h3>
                <p className="text-xs text-emerald-400 font-medium">สแกน Barcode/QR บนกล่องยาเพื่อกรอกข้อมูลอัตโนมัติ</p>
              </div>
            </div>

            {/* ส่วนจัดแสดงกล้อง */}
            <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-inner">
              <div id="reader" className="w-full h-full"></div>
              
              {/* Overlay pulse scanner line */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[2px] bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse pointer-events-none"></div>
              
              {scannerError && (
                <div className="absolute inset-0 p-4 bg-red-950/90 flex flex-col items-center justify-center text-center gap-2 text-red-200">
                  <AlertCircle size={28} className="text-red-400" />
                  <p className="text-xs font-bold leading-relaxed">{scannerError}</p>
                </div>
              )}
            </div>

            <div className="text-xs text-emerald-300/60 leading-relaxed max-w-[90%] mx-auto">
              ถือกล่องยาให้อยู่ในแนวระนาบ โดยชี้ช่องสแกนสีเหลี่ยมผืนผ้าให้ทับบนบาร์โค้ด
            </div>

            <button
              onClick={handleCloseScan}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs tracking-wider transition-all cursor-pointer border border-white/10"
            >
              ยกเลิกการสแกน
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: รายละเอียดใบเบิกที่อ้างอิง ================= */}
      {isReqDetailModalOpen && selectedRequisitionData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div onClick={() => setIsReqDetailModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" />
          <div className="relative w-full max-w-2xl bg-white border border-blue-200/50 rounded-3xl p-6 shadow-2xl z-10 animate-fade-in max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-extrabold text-blue-700 text-lg">{selectedRequisitionData.doc_no}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-bold border border-amber-200">
                    {selectedRequisitionData.status === 'PENDING' ? 'ส่งใบเบิกแล้ว' :
                     selectedRequisitionData.status === 'COMPLETED' ? 'เสร็จสิ้นแล้ว' :
                     selectedRequisitionData.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  วันที่เบิก: {formatDate(selectedRequisitionData.doc_date)}
                  {selectedRequisitionData.requester?.full_name && <> &nbsp;•&nbsp; ผู้เบิก: <strong>{selectedRequisitionData.requester.full_name}</strong></>}
                </p>
              </div>
              <button onClick={() => setIsReqDetailModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                    <th className="py-2 px-3 text-left w-12">#</th>
                    <th className="py-2 px-3 text-left">ชื่อเวชภัณฑ์</th>
                    <th className="py-2 px-3 text-right w-24">จำนวนขอ</th>
                    <th className="py-2 px-3 text-right w-24">รับแล้ว</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedRequisitionData.items?.map((it: import('./hooks/useReceiveForm').RequisitionItem, i: number) => (
                    <tr key={it.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-gray-800">{it.product?.generic_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{it.product?.drug_code}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-gray-700">{it.qty}</td>
                      <td className="py-2.5 px-3 text-right">
                        {(it.received_qty || 0) > 0
                          ? <span className="font-extrabold text-emerald-600">{it.received_qty}</span>
                          : <span className="text-gray-300 font-bold">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ================= IMPORT MODAL ================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div onClick={() => !importStep.includes('processing') && setIsImportModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" />
          <div className="relative w-full max-w-4xl bg-white border border-gray-100 rounded-3xl p-6 shadow-2xl z-10 animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                  <Upload className="text-indigo-600" size={24} />
                  นำเข้าข้อมูลใบรับเวชภัณฑ์ (Import from Excel)
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-1">อัปโหลดไฟล์ Excel/CSV เพื่อนำเข้ารายการเวชภัณฑ์อย่างรวดเร็ว</p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} disabled={importStep === 'processing'}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 relative">
              {importStep === 'upload' && (
                <div className="space-y-6">
                  {importError && (
                    <Alert type="error" message={importError} />
                  )}
                  
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
                    <h3 className="text-sm font-extrabold text-blue-800 mb-2">ขั้นตอนการนำเข้า</h3>
                    <ol className="list-decimal list-inside text-sm text-blue-700/80 space-y-1 font-medium">
                      <li>ดาวน์โหลดไฟล์ Template ต้นแบบ (ปุ่มด้านล่าง)</li>
                      <li>กรอกข้อมูลลงใน Template (ห้ามเปลี่ยนชื่อคอลัมน์) คอลัมน์ที่จำเป็นคือ <span className="font-bold text-blue-900">drug_code</span></li>
                      <li>บันทึกไฟล์และอัปโหลดเข้าสู่ระบบ</li>
                    </ol>
                    <button type="button" onClick={handleDownloadTemplate}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors text-xs font-bold shadow-sm">
                      <Download size={14} /> ดาวน์โหลดไฟล์ Template (.xlsx)
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-gray-200 rounded-3xl p-10 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors relative">
                    <input
                      type="file"
                      ref={importFileRef}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center text-indigo-500 mb-4">
                      <FileSpreadsheet size={32} />
                    </div>
                    <p className="text-sm font-extrabold text-gray-700">คลิก หรือ ลากไฟล์มาวางที่นี่</p>
                    <p className="text-xs text-gray-400 font-medium mt-1">รองรับไฟล์ .xlsx, .xls, .csv</p>
                  </div>
                </div>
              )}

              {importStep === 'processing' && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600 font-bold">กำลังอ่านข้อมูลจากไฟล์...</p>
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100">
                    <p className="text-sm font-extrabold text-indigo-800">
                      พบข้อมูลทั้งหมด: <span className="text-lg text-indigo-600">{importItems.length}</span> รายการ
                    </p>
                  </div>
                  
                  <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500 w-12 text-center">#</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500">รหัสยา</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500">ชื่อเวชภัณฑ์</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500 text-right">จำนวน</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500">Lot Number</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500">EXP Date</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500 text-right">ราคา/หน่วย</th>
                          <th className="py-2.5 px-4 font-extrabold text-gray-500">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {importItems.map((it, idx) => (
                          <tr key={idx} className={!it.product ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                            <td className="py-2.5 px-4 text-center font-bold text-gray-400">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-mono text-xs font-bold">{it.drug_code}</td>
                            <td className="py-2.5 px-4 font-bold text-gray-800">
                              {it.product ? it.product.generic_name : <span className="text-red-500 italic flex items-center gap-1"><AlertCircle size={14}/> ไม่พบรหัสยานี้ในระบบ</span>}
                            </td>
                            <td className="py-2.5 px-4 font-extrabold text-emerald-600 text-right">{it.qty || '-'}</td>
                            <td className="py-2.5 px-4 font-bold">{it.lot_number || '-'}</td>
                            <td className="py-2.5 px-4 font-bold">{it.expiry_date ? formatDate(it.expiry_date) : '-'}</td>
                            <td className="py-2.5 px-4 font-bold text-right">{it.unit_price || '-'}</td>
                            <td className="py-2.5 px-4">
                              {it.product ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">พร้อมนำเข้า</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md font-bold">ข้อมูลผิดพลาด</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {importStep === 'preview' && (
              <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <Button variant="outline" onClick={() => setImportStep('upload')}>ย้อนกลับ</Button>
                <Button 
                  onClick={handleConfirmImport} 
                  disabled={importItems.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6"
                >
                  ยืนยันการนำเข้าข้อมูล
                </Button>
              </div>
            )}
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
                    <p className="text-emerald-100 text-xs font-medium mt-0.5">หน้าบันทึกรับเข้าเวชภัณฑ์</p>
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

              {/* Section: ลำดับช่องกรอกข้อมูล */}
              <section>
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2.5">ลำดับช่องกรอกข้อมูล (Tab Order)</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { num: '1', label: 'เลือกยา' },
                    { num: '2', label: 'จำนวนรับ' },
                    { num: '3', label: 'Lot Number' },
                    { num: '4', label: 'วันหมดอายุ' },
                    { num: '5', label: 'ราคา/หน่วย' },
                    { num: '6', label: 'หมายเหตุ' },
                  ].map(({ num, label }, i, arr) => (
                    <>
                      <div key={label} className="flex flex-col items-center gap-1">
                        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-extrabold flex items-center justify-center border border-emerald-200">{num}</span>
                        <span className="text-[11px] text-gray-500 font-medium text-center leading-tight">{label}</span>
                      </div>
                      {i < arr.length - 1 && (
                        <span key={`arr-${i}`} className="text-gray-300 font-bold text-lg mb-4">→</span>
                      )}
                    </>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2.5">เมื่อกด Tab ที่ช่อง <strong>หมายเหตุ</strong> ของแถวสุดท้าย ระบบจะ <strong className="text-emerald-600">เพิ่มแถวใหม่</strong> อัตโนมัติและโฟกัสที่ช่องจำนวนรับ</p>
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

      <ReceiveRelationalImportModal
        isOpen={isRelationalImportOpen}
        onClose={() => setIsRelationalImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />

    </div>
  );
}

