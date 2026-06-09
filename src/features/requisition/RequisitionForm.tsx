import React, { useState, useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { DatePicker } from '@/components/ui/DatePicker';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useOfficers } from '@/hooks/useOfficers';
import { 
  Search, Plus, Trash2, Download, Upload, X, Check, FileSpreadsheet, AlertCircle, Loader2, Info, ChevronDown, ChevronRight, ClipboardList, Keyboard, History
} from 'lucide-react';
import { useKeyboardGridNavigator } from '@/hooks/useKeyboardGridNavigator';
import { useRequisitionForm } from './hooks/useRequisitionForm';

// ==========================================
// Custom Dropdown Component (Same design as SettingsPage)
// ==========================================
interface CustomOfficerSelectProps {
  value: string;
  onChange: (value: string) => void;
  officers: { id: string; full_name: string; position?: string; user_id?: string }[];
  placeholder?: string;
}

function CustomOfficerSelect({ value, onChange, officers, placeholder = '-- เลือกเจ้าหน้าที่ --' }: CustomOfficerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOfficer = officers.find(s => s.id === value);
  const filteredOfficers = officers.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.position && s.position.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border ${
          isOpen ? 'border-emerald-500 ring-4 ring-emerald-50 shadow-md' : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
        } rounded-xl text-left transition-all outline-none duration-200`}
      >
        <div className="flex flex-col min-w-0 pr-2">
          {selectedOfficer ? (
            <>
              <span className="font-extrabold text-gray-900 text-sm leading-tight truncate">
                {selectedOfficer.full_name}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 truncate mt-0.5 leading-none">
                {selectedOfficer.position || 'ยังไม่กำหนดตำแหน่ง'}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-gray-400 italic">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''} shrink-0`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden origin-top max-h-64 flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Search size={14} className="text-emerald-500 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือตำแหน่ง..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none py-1 text-gray-700 placeholder-gray-400 font-bold"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {filteredOfficers.length > 0 ? (
              filteredOfficers.map((officer) => (
                <button
                  key={officer.id}
                  type="button"
                  onClick={() => {
                    onChange(officer.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex flex-col ${
                    value === officer.id ? 'bg-emerald-50/70 border-l-4 border-emerald-500' : ''
                  }`}
                >
                  <span className="text-xs font-black text-gray-900">{officer.full_name}</span>
                  <span className="text-[10px] text-gray-500 font-semibold mt-0.5">{officer.position || '-'}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-xs text-gray-400 font-bold">ไม่พบรายชื่อเจ้าหน้าที่</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequisitionForm() {
  const { id } = useParams<{ id: string }>();
  const { officers } = useOfficers();
  const navigate = useNavigate();

  const {
    isEditMode,
    editDocNo,
    isSubmitting,
    productSearch,
    setProductSearch,
    searchResults,
    systemAgeInDays,
    globalMonths,
    isLoadingAll,
    activeSearchRowIndex,
    setActiveSearchRowIndex,
    dropdownSelectedIndex,
    setDropdownSelectedIndex,
    isShortcutsGuideOpen,
    setIsShortcutsGuideOpen,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    isImportModalOpen,
    setIsImportModalOpen,
    importStep,
    setImportStep,
    importMode,
    setImportMode,
    singleImportItems,
    multiImportBlocks,
    activePreviewBlockIndex,
    setActivePreviewBlockIndex,
    safetyStockMonths,
    importDocHeader,
    importError,
    importResultList,
    searchContainerRef,
    importFileRef,
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    errors,
    fields,
    append,
    remove,
    watchItems,
    handleSelectProduct,
    handleAutoAdjustQty,
    handleAddAllActiveProducts,
    downloadStandardTemplate,
    downloadRelationalTemplate,
    downloadCSVTemplate,
    handleFileUpload,
    handleConfirmSingleImport,
    handleConfirmMultiImport,
    handleCloseImportModal,
    onSubmit,
    onInvalid,
    currentDocNoPlaceholder
  } = useRequisitionForm(id, officers);

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in-up font-sans select-none pb-12">
      {/* Page Header */}
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-100/55 shadow-md shadow-emerald-950/5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">
              {isEditMode ? 'แก้ไขใบเบิกเวชภัณฑ์ (Edit Requisition)' : 'สร้างใบเบิกเวชภัณฑ์ (New Requisition)'}
            </h1>
            <p className="text-sm text-emerald-700 font-medium mt-1">
              สร้างใบขอเบิกเวชภัณฑ์จากคลังหลัก (Main Warehouse Requisition)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleAddAllActiveProducts}
            className="px-5 py-2.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-xl hover:bg-emerald-100 hover:text-emerald-800 transition-all text-xs border border-emerald-200 cursor-pointer flex items-center gap-2"
          >
            <Plus size={15} /> ดึงเวชภัณฑ์ทั้งหมดที่มีในคลัง
          </button>
          <Link
            to="/requisition/history"
            className="px-5 py-2.5 bg-white text-emerald-800 font-extrabold rounded-xl hover:bg-emerald-50 transition-all text-xs border border-emerald-200 shadow-sm cursor-pointer flex items-center gap-2"
          >
            <History size={15} /> ประวัติใบขอเบิก
          </Link>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-5 py-2.5 bg-white text-emerald-800 font-extrabold rounded-xl hover:bg-emerald-50 transition-all text-xs border border-emerald-200 shadow-sm cursor-pointer flex items-center gap-2"
          >
            <Upload size={15} /> นำเข้าใบเบิก (Excel/CSV)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {/* Document Header Metadata Section */}
        <div className="glass p-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2 border-b border-emerald-100/80 pb-3">
            <Info size={16} className="text-emerald-600" />
            ข้อมูลรายละเอียดเอกสารและเจ้าหน้าที่รับผิดชอบ
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Document Number (Read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-emerald-950">เลขที่เอกสาร</label>
              <input
                type="text"
                disabled
                value={isEditMode ? (editDocNo || 'DRAFT (Auto Update)') : currentDocNoPlaceholder}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs text-gray-500 outline-none transition-all"
                title="เลขที่เอกสารจะถูกสร้างอัตโนมัติเมื่อบันทึก เพื่อป้องกันการซ้ำซ้อน"
              />
            </div>

            {/* Date Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-emerald-950">วันที่เบิก</label>
              <Controller
                control={control}
                name="doc_date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-xs text-gray-800 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
                  />
                )}
              />
              {errors.doc_date && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.doc_date.message}</p>}
            </div>

            {/* Requester Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-emerald-950">ผู้ขอเบิก (Requester)</label>
              <Controller
                control={control}
                name="requester_id"
                render={({ field }) => (
                  <CustomOfficerSelect
                    value={field.value}
                    onChange={field.onChange}
                    officers={officers}
                    placeholder="-- เลือกเจ้าหน้าที่ผู้เบิก --"
                  />
                )}
              />
              {errors.requester_id && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.requester_id.message}</p>}
            </div>

            {/* Approver Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-emerald-950">ผู้อนุมัติ (Main Warehouse Approver)</label>
              <Controller
                control={control}
                name="approver_id"
                render={({ field }) => (
                  <CustomOfficerSelect
                    value={field.value}
                    onChange={field.onChange}
                    officers={officers}
                    placeholder="-- เลือกผู้อนุมัติจ่าย --"
                  />
                )}
              />
              {errors.approver_id && <p className="text-red-500 text-[10px] font-bold mt-1">{errors.approver_id.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-black text-emerald-950">หมายเหตุหัวใบเบิก (Remarks)</label>
            <textarea
              placeholder="ระบุหมายเหตุโครงการหรือรายละเอียดการขอเบิก (ถ้ามี)..."
              {...register('remarks')}
              rows={2}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-emerald-50 outline-none transition-all"
            />
          </div>
        </div>

        {/* Global Errors Alert */}
        {errors.items?.root?.message && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-pulse shadow-sm">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{errors.items.root.message}</span>
          </div>
        )}

        {/* Requisition Table Section */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-visible">
          <div className="overflow-x-auto min-h-[400px] pb-24">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-extrabold uppercase tracking-wider text-xs border-b border-gray-100">
                  <th className="p-4 w-12 text-center">#</th>
                  {/* Sortable: Name */}
                  <th className="p-4 w-80">
                    <button
                      type="button"
                      onClick={() => { if (sortBy === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('name'); setSortDir('asc'); } }}
                      className={`flex items-center gap-1 cursor-pointer hover:text-emerald-700 transition-colors font-extrabold ${sortBy === 'name' ? 'text-emerald-700' : ''}`}
                    >
                      ชื่อเวชภัณฑ์ (Product Name) {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  {/* Sortable: Dosage Form */}
                  <th className="p-4 w-24">
                    <button
                      type="button"
                      onClick={() => { if (sortBy === 'dosage_form') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('dosage_form'); setSortDir('asc'); } }}
                      className={`flex items-center gap-1 cursor-pointer hover:text-emerald-700 transition-colors font-extrabold ${sortBy === 'dosage_form' ? 'text-emerald-700' : ''}`}
                    >
                      รูปแบบ (Dosage Form) {sortBy === 'dosage_form' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="p-4 w-28 text-center">คงเหลือ (On Hand)</th>
                  <th className="p-4 w-40 text-center">อัตราการใช้ (Usage Rate)</th>
                  <th className="p-4 w-32 text-center">จำนวนเบิก (Requested Qty)</th>
                  <th className="p-4 w-48 text-center">หมายเหตุ (Remarks)</th>
                  <th className="p-4 w-14 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  // Compute sorted indexes
                  const indexes = watchItems.map((_, i) => i);
                  if (sortBy) {
                    indexes.sort((a, b) => {
                      const ia = watchItems[a];
                      const ib = watchItems[b];
                      let va = '';
                      let vb = '';
                      if (sortBy === 'name') { va = ia?.product_name || ''; vb = ib?.product_name || ''; }
                      else if (sortBy === 'code') { va = ia?.drug_code || ''; vb = ib?.drug_code || ''; }
                      else if (sortBy === 'dosage_form') { va = ia?.dosage_form_name || ''; vb = ib?.dosage_form_name || ''; }
                      const cmp = va.localeCompare(vb, 'th');
                      return sortDir === 'asc' ? cmp : -cmp;
                    });
                  }
                  return indexes;
                })().map((index) => {
                  const field = fields[index];
                  const item = watchItems[index] || {};
                  const isDrugSelected = !!item.product_id;

                  return (
                    <tr key={field.id} className="hover:bg-emerald-50/15 transition-colors group">
                      {/* Row Index */}
                      <td className="p-4 text-center text-gray-400 font-semibold">{index + 1}</td>

                      {/* Product Name & Search Autocomplete Box */}
                      <td className={`p-4 relative ${activeSearchRowIndex === index ? 'z-[60]' : ''}`}>
                        <div className="relative" ref={activeSearchRowIndex === index ? searchContainerRef : null}>
                          {isDrugSelected && activeSearchRowIndex !== index ? (
                            <div 
                              tabIndex={0}
                              data-row={index}
                              data-col={0}
                              className="nav-cell cursor-pointer group p-2 border border-transparent hover:border-emerald-200 hover:bg-emerald-50 rounded-xl transition-all outline-none focus:ring-2 focus:ring-emerald-500"
                              onClick={() => {
                                  setProductSearch('');
                                  setActiveSearchRowIndex(index);
                                  setTimeout(() => document.getElementById(`search-input-${index}`)?.focus(), 50);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setProductSearch('');
                                  setActiveSearchRowIndex(index);
                                  setTimeout(() => document.getElementById(`search-input-${index}`)?.focus(), 50);
                                }
                              }}
                              title="คลิกหรือกด Enter เพื่อเปลี่ยนเวชภัณฑ์"
                            >
                              <div className="font-black text-gray-900 leading-tight">
                                {item.product_name} {item.trade_name && <span className="text-gray-500 font-bold ml-1 text-[10px]">({item.trade_name})</span>}
                              </div>
                              <div className="flex flex-wrap gap-1.5 text-[9px] font-bold text-gray-500 mt-1.5">
                                {item.drug_code && (
                                  <span className="font-mono font-extrabold text-indigo-800 text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded select-none">
                                    {item.drug_code}
                                  </span>
                                )}
                                {item.is_cold_storage && (
                                  <span className="bg-cyan-100 px-1.5 py-0.5 rounded text-cyan-700 border border-cyan-200">
                                    COLD
                                  </span>
                                )}
                                {item.is_high_alert && (
                                  <span className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-700 border border-amber-200">
                                    HAD
                                  </span>
                                )}
                                {item.is_psycho_narco && (
                                  <span className="bg-rose-100 px-1.5 py-0.5 rounded text-rose-700 border border-rose-200">
                                    PSYCO
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                id={`search-input-${index}`}
                                data-row={index}
                                data-col={0}
                                placeholder="🔍 พิมพ์ชื่อสามัญ (Generic), รหัส, หรือ Trade Name..."
                                value={activeSearchRowIndex === index ? productSearch : ''}
                                onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setActiveSearchRowIndex(index);
                                  setDropdownSelectedIndex(-1);
                                }}
                                onFocus={() => {
                                  setProductSearch('');
                                  setActiveSearchRowIndex(index);
                                  setDropdownSelectedIndex(-1);
                                }}
                                onKeyDown={(e) => {
                                  if (searchResults.length > 0) {
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDropdownSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDropdownSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                                    } else if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (dropdownSelectedIndex >= 0 && searchResults[dropdownSelectedIndex]) {
                                        handleSelectProduct(index, searchResults[dropdownSelectedIndex]);
                                      } else if (searchResults.length > 0) {
                                        handleSelectProduct(index, searchResults[0]);
                                      }
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveSearchRowIndex(null);
                                    }
                                  }
                                }}
                                className="nav-cell w-full px-3.5 py-2 border border-gray-200 rounded-xl font-bold placeholder-gray-400 outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all text-sm"
                              />
                              
                              {/* Search Dropdown */}
                              {activeSearchRowIndex === index && searchResults.length > 0 && (
                                <div className="absolute z-[70] w-[85vw] sm:w-[500px] left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-gray-50">
                                  {searchResults.map((p, pIndex) => {
                                    const isHighlighted = pIndex === dropdownSelectedIndex;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectProduct(index, p)}
                                        onMouseEnter={() => setDropdownSelectedIndex(pIndex)}
                                        className={`w-full text-left px-4 py-2.5 transition-colors flex flex-col ${
                                          isHighlighted ? 'bg-emerald-100' : 'hover:bg-emerald-50'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start">
                                          <span className="font-extrabold text-gray-900 text-sm">
                                            {p.generic_name} {p.trade_name && <span className="text-gray-500 font-bold ml-1 text-xs">({p.trade_name})</span>}
                                          </span>
                                        </div>
                                        <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                          <span className="text-[11px] bg-gray-100 px-1.5 rounded text-gray-500 border border-gray-200 font-bold">
                                            {p.drug_code || '-'}
                                          </span>
                                          <span className="text-[11px] text-emerald-600 font-bold">
                                            บรรจุ {p.pack_size} {(p.master_units as any)?.name || (p.master_units as any)?.unit_name || ''}
                                          </span>
                                          {(p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.abbreviation || (p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.name_en ? (
                                            <span className="text-[11px] bg-purple-50 px-1.5 rounded text-purple-700 border border-purple-200 font-bold">
                                              {(p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.abbreviation && (p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.name_en
                                                ? `${(p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string }).abbreviation} (${(p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string }).name_en})`
                                                : (p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.abbreviation || (p.master_dosage_forms as unknown as { abbreviation?: string; name_en?: string })?.name_en}
                                            </span>
                                          ) : null}
                                          {p.is_cold_storage && (
                                            <span className="text-[10px] bg-cyan-100 px-1 rounded text-cyan-700 font-bold">COLD</span>
                                          )}
                                          {p.is_high_alert && (
                                            <span className="text-[10px] bg-amber-100 px-1 rounded text-amber-700 font-bold">HAD</span>
                                          )}
                                          {p.is_psycho_narco && (
                                            <span className="text-[10px] bg-rose-100 px-1 rounded text-rose-700 font-bold">PSYCO</span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {errors.items?.[index]?.product_id && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            {errors.items[index]?.product_id?.message}
                          </p>
                        )}
                      </td>

                      {/* Dosage Form */}
                      <td className="p-3 text-center">
                        {isDrugSelected && item.dosage_form_name ? (
                          <span className="text-xs font-extrabold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded whitespace-nowrap">
                            {item.dosage_form_name}
                          </span>
                        ) : <span className="text-gray-200">-</span>}
                      </td>

                      {/* Stock Substore */}
                      <td className="p-4 text-center font-bold text-gray-700 whitespace-nowrap">
                        {isDrugSelected ? (
                          <div className="space-y-0.5">
                            <span className="text-sm text-gray-800 font-black">{item.substock_qty || 0}</span>
                            <span className="text-xs text-gray-400 font-bold block">{item.unit_name || 'ชิ้น'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* Usage Rate Cell */}
                      <td className="p-4">
                        {isDrugSelected ? (
                          <div className="space-y-1.5 select-none w-48">
                            <span className="text-xs font-bold text-gray-400 block">เลือกอัตราใช้ (คลิกเพื่อใช้):</span>
                            <div className="flex gap-2">
                              {/* 1. Manual Badge */}
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`items.${index}.usage_rate`, item.manual_monthly_usage || 0);
                                  setValue(`items.${index}.is_manual_rate`, true);
                                }}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-center transition-all border text-xs cursor-pointer ${
                                  item.is_manual_rate
                                    ? 'bg-emerald-600 border-emerald-700 text-white font-extrabold shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <div className={item.is_manual_rate ? 'text-emerald-100 text-[10px] font-bold' : 'text-gray-400 text-[10px]'}>
                                  ฐานข้อมูล
                                </div>
                                <div className="text-sm font-black mt-0.5">
                                  {item.manual_monthly_usage || 0}
                                </div>
                              </button>

                              {/* 2. Auto Calculated Badge */}
                              <button
                                type="button"
                                onClick={() => {
                                  setValue(`items.${index}.usage_rate`, item.avg_monthly_usage || 0);
                                  setValue(`items.${index}.is_manual_rate`, false);
                                }}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-center transition-all border text-xs cursor-pointer ${
                                  !item.is_manual_rate
                                    ? 'bg-indigo-600 border-indigo-700 text-white font-extrabold shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <div className={!item.is_manual_rate ? 'text-indigo-100 text-[10px] font-bold' : 'text-gray-400 text-[10px]'}>
                                  คำนวณ
                                </div>
                                <div className="text-sm font-black mt-0.5">
                                  {item.avg_monthly_usage || 0}
                                </div>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* Quantity Input with Quick Balance Helpers */}
                      <td className="p-4">
                        {isDrugSelected ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                data-row={index}
                                data-col={1}
                                {...register(`items.${index}.qty`, { valueAsNumber: true })}
                                className="nav-cell w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-center font-black text-gray-800 focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-sm"
                              />
                              <span className="font-bold text-slate-500 text-sm whitespace-nowrap ml-1.5">
                                {item.pack_size && item.pack_size !== 1 ? `x ${item.pack_size} ` : ''}{item.unit_name || 'ชิ้น'}
                              </span>
                            </div>
                            {errors.items?.[index]?.qty && (
                              <p className="text-red-500 text-[10px] font-bold">
                                {errors.items[index]?.qty?.message}
                              </p>
                            )}

                            {/* Stock alignment helper buttons */}
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleAutoAdjustQty(index, (item.usage_rate || 0) * safetyStockMonths)}
                                className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-[10px] font-bold text-gray-600 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                                title="ปรับยอดเบิกให้ยอดรวมเท่ากับอัตราความต้องการ"
                              >
                                เติมเต็มสต๊อก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="p-4">
                        {isDrugSelected ? (
                          <input
                            type="text"
                            placeholder="หมายเหตุรายการ..."
                            data-row={index}
                            data-col={2}
                            {...register(`items.${index}.remarks`)}
                            className="nav-cell w-full px-3 py-1.5 border border-gray-200 rounded-xl font-bold placeholder-gray-400 text-gray-700 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-sm"
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* Remove Row Button */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Row Button Footer */}
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
            <button
              type="button"
              onClick={() => append({
                product_id: '',
                product_name: '',
                qty: 0,
                pack_size: 1,
                is_manual_rate: true,
                months: globalMonths,
                suggested_qty: 0,
                avg_monthly_usage: 0,
                manual_monthly_usage: 0,
                usage_rate: 0,
                drug_code: '',
                is_psycho_narco: false,
                is_high_alert: false,
                is_cold_storage: false,
                substock_qty: 0,
                remarks: '',
              })}
              className="px-4 py-2 bg-white text-emerald-800 font-extrabold border border-gray-200 rounded-xl hover:bg-emerald-50 transition-colors text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus size={14} /> เพิ่มรายการเวชภัณฑ์
            </button>
            <span className="text-[10px] font-bold text-gray-400">
              เวชภัณฑ์ทั้งหมดในเอกสาร: {watchItems.length} รายการ
            </span>
          </div>
        </div>

        {/* Submit Actions Footer */}
        <div className="flex justify-end gap-3.5">
          <button
            type="button"
            onClick={() => navigate('/requisition/history')}
            className="px-5 py-3 bg-gray-100 text-gray-700 font-extrabold rounded-2xl hover:bg-gray-200 transition-colors text-xs cursor-pointer"
          >
            ยกเลิกและย้อนกลับ
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoadingAll}
            className="px-7 py-3 bg-emerald-600 text-white font-extrabold rounded-2xl hover:bg-emerald-700 transition-all text-xs cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-700/10 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> กำลังบันทึกข้อมูล...
              </>
            ) : (
              <>
                <Check size={15} /> บันทึกใบเบิกยา (ฉบับร่าง)
              </>
            )}
          </button>
        </div>
      </form>

      {/* ================= IMPORT TEMPLATE MODAL ================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-150 overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black tracking-wide uppercase">นำเข้าใบเบิกเวชภัณฑ์ด้วยระบบไฟล์เอกสาร</h3>
                  <p className="text-[10px] text-emerald-200 font-semibold mt-0.5">รองรับรูปแบบไฟล์ Excel (.xlsx) และไฟล์ CSV แบบหลายใบเบิก (Multi-Block)</p>
                </div>
              </div>
              <button
                onClick={handleCloseImportModal}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              
              {/* STEP 1: Upload step */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  {/* Instructions */}
                  <div className="bg-emerald-50/40 border border-emerald-100 p-4.5 rounded-2xl text-xs leading-relaxed space-y-3">
                    <h4 className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs">
                      <Info size={14} className="text-emerald-600" />
                      คำแนะนำการสร้างและนำเข้าไฟล์ใบเบิก
                    </h4>
                    <ul className="list-disc pl-5 space-y-1.5 font-semibold text-emerald-800">
                      <li>ระบบรองรับการสร้างใบเบิกได้หลายใบพร้อมกันโดยการ <span className="underline">แยกชีต (Sheet)</span> ตามเลขที่ใบเบิก</li>
                      <li>ในแต่ละใบเบิกจะต้องระบุชื่อ <strong>ผู้เบิก (requester)</strong> และ <strong>ผู้อนุมัติจ่าย (approver)</strong> ให้สอดคล้องกับพนักงานในระบบ</li>
                      <li>คอลัมน์รายการยาที่สำคัญ: <code className="bg-emerald-100 px-1 rounded text-emerald-800">drug_code</code> (รหัสยา) และ <code className="bg-emerald-100 px-1 rounded text-emerald-800">qty</code> (จำนวนที่เบิก)</li>
                    </ul>
                  </div>

                  {/* Template Download Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={downloadStandardTemplate}
                      className="p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/10 hover:shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between h-32"
                    >
                      <FileSpreadsheet className="text-emerald-600" size={24} />
                      <div>
                        <span className="text-xs font-black text-gray-900 block">Template Excel มาตรฐาน</span>
                        <span className="text-[10px] text-gray-500 font-semibold block mt-1">
                          (แยก Sheet คละหลายใบเบิก โครงสร้างชัดเจน)
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={downloadRelationalTemplate}
                      className="p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/10 hover:shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between h-32"
                    >
                      <FileSpreadsheet className="text-emerald-600" size={24} />
                      <div>
                        <span className="text-xs font-black text-gray-900 block">Template เชื่อมโยงความสัมพันธ์</span>
                        <span className="text-[10px] text-gray-500 font-semibold block mt-1">
                          (Sheet แรกเป็นหัวเอกสาร Sheet สองเป็นรายการยาอ้างอิง)
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={downloadCSVTemplate}
                      className="p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/10 hover:shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between h-32"
                    >
                      <FileSpreadsheet className="text-emerald-600" size={24} />
                      <div>
                        <span className="text-xs font-black text-gray-900 block">Template Multi-Block CSV</span>
                        <span className="text-[10px] text-gray-500 font-semibold block mt-1">
                          (ใช้สำหรับนำเข้าระบบ CSV แบบหลายใบเบิกคั่นด้วย Start/End)
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Drop File Zone */}
                  <div
                    onClick={() => importFileRef.current?.click()}
                    className="border-2 border-dashed border-gray-250 hover:border-emerald-500 hover:bg-emerald-50/10 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-3"
                  >
                    <input
                      type="file"
                      ref={importFileRef}
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <Upload size={32} className="text-gray-400 mx-auto" />
                    <span className="text-xs font-black text-gray-700 block">คลิกที่นี่ เพื่อเลือกอัปโหลดไฟล์ในเครื่อง</span>
                    <span className="text-[10px] text-gray-400 font-semibold block">รองรับนามสกุลไฟล์ .xlsx, .xls, .csv</span>
                  </div>

                  {importError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-xs font-bold whitespace-pre-line flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Processing step */}
              {importStep === 'processing' && (
                <div className="py-16 text-center space-y-4">
                  <Loader2 size={36} className="text-emerald-600 animate-spin mx-auto" />
                  <span className="text-xs font-extrabold text-gray-700 block animate-pulse">
                    ระบบกำลังทำการวิเคราะห์โครงสร้างไฟล์ ค้นหา และจับคู่รหัสยา รหัสพนักงานในฐานข้อมูลระบบ...
                  </span>
                </div>
              )}

              {/* STEP 3: Preview list step */}
              {importStep === 'preview' && (
                <div className="space-y-6">
                  {importError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-xs font-bold whitespace-pre-line flex items-start gap-2.5 shadow-sm">
                      <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-red-800 block mb-0.5">พบบันทึกข้อผิดพลาดในการนำเข้าฐานข้อมูล:</span>
                        <span className="font-medium text-red-700">{importError}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Single Requisition Mode Preview */}
                  {importMode === 'single' && (
                    <div className="space-y-4">
                      {/* Document info summary */}
                      <div className="bg-gray-50 border border-gray-150 p-4.5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-gray-400 font-bold block">เลขใบเบิก (ในไฟล์):</span>
                          <span className="font-extrabold text-gray-900">{importDocHeader?.doc_no || 'ยังไม่มี'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-bold block">วันที่ขอเบิก (ในไฟล์):</span>
                          <span className="font-extrabold text-gray-900">{importDocHeader?.doc_date || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-bold block">ผู้ขอเบิก (ในไฟล์):</span>
                          <span className="font-extrabold text-emerald-700">
                            {importDocHeader?.requester || '-'}
                            {importDocHeader?.requester && officers.find(s => s.full_name?.toLowerCase().includes(importDocHeader.requester.toLowerCase())) ? (
                              <span className="text-[9px] text-emerald-600 block">(แมตช์พบในระบบ)</span>
                            ) : (
                              <span className="text-[9px] text-amber-600 block">(ไม่พบรายชื่อในระบบ)</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-bold block">ผู้อนุมัติจ่าย (ในไฟล์):</span>
                          <span className="font-extrabold text-emerald-700">
                            {importDocHeader?.approver || '-'}
                            {importDocHeader?.approver && officers.find(s => s.full_name?.toLowerCase().includes(importDocHeader.approver.toLowerCase())) ? (
                              <span className="text-[9px] text-emerald-600 block">(แมตช์พบในระบบ)</span>
                            ) : (
                              <span className="text-[9px] text-amber-600 block">(ไม่พบรายชื่อในระบบ)</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Items table preview */}
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase border-b border-gray-100">
                              <th className="p-3 w-12 text-center">แถว</th>
                              <th className="p-3 w-28">รหัสเวชภัณฑ์</th>
                              <th className="p-3">ชื่อเวชภัณฑ์ (ในระบบ)</th>
                              <th className="p-3 w-20 text-center">จำนวน</th>
                              <th className="p-3 w-20 text-center">ยอดสต๊อกย่อย</th>
                              <th className="p-3 w-20 text-center">อัตราใช้</th>
                              <th className="p-3">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {singleImportItems.map((item, idx) => (
                              <tr key={idx} className={item.status === 'ready' ? 'hover:bg-emerald-50/10' : 'bg-red-50/20'}>
                                <td className="p-3 text-center text-gray-400 font-semibold">{item.rowNum}</td>
                                <td className="p-3 font-mono font-bold text-gray-800">{item.drug_code}</td>
                                <td className="p-3 font-bold text-gray-900">{item.product_name}</td>
                                <td className="p-3 text-center font-extrabold text-gray-800">{item.qty}</td>
                                <td className="p-3 text-center text-gray-500 font-semibold">{item.substock_qty}</td>
                                <td className="p-3 text-center text-gray-500 font-semibold">{item.manual_monthly_usage}</td>
                                <td className="p-3">
                                  {item.status === 'ready' ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold text-[9px] flex items-center gap-1 w-max">
                                      <Check size={10} /> พร้อมนำเข้า
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-bold text-[9px] flex items-center gap-1 w-max" title={item.errorMessage}>
                                      <X size={10} /> {item.errorMessage}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Multi Requisition Mode Preview */}
                  {importMode === 'multi' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Left Navigation side list */}
                      <div className="lg:col-span-1 border border-gray-150 rounded-2xl overflow-hidden divide-y divide-gray-100">
                        <div className="bg-gray-50 p-3.5 border-b border-gray-100 font-black text-gray-700 text-xs shrink-0">
                          เอกสารทั้งหมดที่ตรวจพบ ({multiImportBlocks.length})
                        </div>
                        <div className="overflow-y-auto max-h-96">
                          {multiImportBlocks.map((block, idx) => {
                            const errCount = block.items.filter((item: import('./hooks/useRequisitionForm').ImportItem) => item.status !== 'ready').length;
                            const isSelected = activePreviewBlockIndex === idx;

                            return (
                              <button
                                key={idx}
                                onClick={() => setActivePreviewBlockIndex(idx)}
                                type="button"
                                className={`w-full text-left p-3.5 hover:bg-emerald-50 transition-colors flex justify-between items-center border-l-4 ${
                                  isSelected ? 'bg-emerald-50/70 border-emerald-500' : 'border-transparent'
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <span className="text-xs font-black text-gray-900 block truncate">
                                    {block.docHeader.doc_no || `ใบเบิก #${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold block">
                                    จำนวน {block.items.length} รายการ
                                  </span>
                                </div>
                                {errCount > 0 ? (
                                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md font-black text-[9px] shrink-0">
                                    ⚠️ {errCount}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-black text-[9px] shrink-0">
                                    ✓ OK
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Details side panel */}
                      <div className="lg:col-span-3 space-y-4">
                        {(() => {
                          const currentBlock = multiImportBlocks[activePreviewBlockIndex];
                          if (!currentBlock) return null;

                          return (
                            <div className="space-y-4">
                              {/* Header details */}
                              <div className="bg-gray-50 border border-gray-150 p-4.5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-gray-400 font-bold block">เลขใบเบิก:</span>
                                  <span className="font-extrabold text-gray-900">{currentBlock.docHeader.doc_no || 'ยังไม่มี'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-bold block">วันที่ขอเบิก:</span>
                                  <span className="font-extrabold text-gray-900">{currentBlock.docHeader.doc_date || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-bold block">ผู้ขอเบิก:</span>
                                  <span className="font-extrabold text-emerald-700">
                                    {currentBlock.docHeader.requester || '-'}
                                    {currentBlock.matchedRequesterId ? (
                                      <span className="text-[9px] text-emerald-600 block">(แมตช์พบในระบบ)</span>
                                    ) : (
                                      <span className="text-[9px] text-amber-600 block">(ไม่พบรายชื่อพนักงาน)</span>
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400 font-bold block">ผู้อนุมัติจ่าย:</span>
                                  <span className="font-extrabold text-emerald-700">
                                    {currentBlock.docHeader.approver || '-'}
                                    {currentBlock.matchedApproverId ? (
                                      <span className="text-[9px] text-emerald-600 block">(แมตช์พบในระบบ)</span>
                                    ) : (
                                      <span className="text-[9px] text-amber-600 block">(ไม่พบรายชื่อพนักงาน)</span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Error alert inside block */}
                              {currentBlock.errors.length > 0 && (
                                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-[11px] font-bold">
                                  {currentBlock.errors.join(', ')}
                                </div>
                              )}

                              {/* Table details */}
                              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase border-b border-gray-100">
                                      <th className="p-3 w-12 text-center">แถว</th>
                                      <th className="p-3 w-28">รหัสเวชภัณฑ์</th>
                                      <th className="p-3">ชื่อเวชภัณฑ์ (ในระบบ)</th>
                                      <th className="p-3 w-20 text-center">จำนวน</th>
                                      <th className="p-3 w-20 text-center">คงคลังย่อย</th>
                                      <th className="p-3 w-20 text-center">อัตราใช้</th>
                                      <th className="p-3">สถานะ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {currentBlock.items.map((item: import('./hooks/useRequisitionForm').ImportItem, idx: number) => (
                                      <tr key={idx} className={item.status === 'ready' ? 'hover:bg-emerald-50/10' : 'bg-red-50/20'}>
                                        <td className="p-3 text-center text-gray-400 font-semibold">{item.rowNum}</td>
                                        <td className="p-3 font-mono font-bold text-gray-800">{item.drug_code}</td>
                                        <td className="p-3 font-bold text-gray-900">{item.product_name}</td>
                                        <td className="p-3 text-center font-extrabold text-gray-800">{item.qty}</td>
                                        <td className="p-3 text-center text-gray-500 font-semibold">{item.substock_qty}</td>
                                        <td className="p-3 text-center text-gray-500 font-semibold">{item.manual_monthly_usage}</td>
                                        <td className="p-3">
                                          {item.status === 'ready' ? (
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold text-[9px] flex items-center gap-1 w-max">
                                              <Check size={10} /> พร้อม
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md font-bold text-[9px] flex items-center gap-1 w-max" title={item.errorMessage}>
                                              <X size={10} /> ล้มเหลว
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {importError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-xs font-bold whitespace-pre-line flex items-start gap-2.5">
                      <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Success Multi requisitions save summary */}
              {importStep === 'success' && (
                <div className="space-y-6 py-6">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <Check size={28} />
                    </div>
                    <h4 className="text-base font-black text-gray-900">บันทึกข้อมูลใบเบิกเข้าสู่ระบบสำเร็จแล้ว!</h4>
                    <p className="text-xs text-gray-500 font-semibold">
                      ระบบได้บันทึกใบเบิกทั้งหมดจำนวน {importResultList.length} ใบเสร็จเข้าสู่ฐานข้อมูลเรียบร้อยแล้ว
                    </p>
                  </div>

                  <div className="border border-gray-150 rounded-2xl overflow-hidden divide-y divide-gray-50 max-h-40 overflow-y-auto">
                    {importResultList.map((res, idx) => (
                      <div key={idx} className="p-4 flex justify-between items-center text-xs">
                        <span className="font-mono font-black text-emerald-900">{res.doc_no}</span>
                        <span className="font-extrabold text-gray-500">บันทึกสำเร็จ {res.count} รายการ</span>
                      </div>
                    ))}
                  </div>

                  {importError && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider">⚠️ มีข้อผิดพลาดบางรายการเกิดขึ้นระหว่างการนำเข้า:</span>
                      <div className="p-4 bg-amber-50/50 border border-amber-100 text-amber-900 rounded-2xl text-[11px] font-semibold whitespace-pre-line max-h-36 overflow-y-auto">
                        {importError}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 flex justify-end gap-3 shrink-0">
              {importStep === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={() => setImportStep('upload')}
                    className="px-4 py-2 bg-white text-gray-700 font-extrabold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-xs cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  {importMode === 'single' ? (
                    <button
                      type="button"
                      onClick={handleConfirmSingleImport}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 transition-all text-xs cursor-pointer"
                    >
                      ยืนยันการเพิ่มลงฟอร์ม
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmMultiImport}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 transition-all text-xs cursor-pointer"
                    >
                      ยืนยันบันทึกเข้าระบบทั้งหมด
                    </button>
                  )}
                </>
              )}

              {importStep === 'success' && (
                <>
                  <button
                    type="button"
                    onClick={handleCloseImportModal}
                    className="px-4 py-2 bg-gray-100 text-gray-750 font-extrabold rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseImportModal();
                      navigate('/requisition/history');
                    }}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 transition-all text-xs cursor-pointer"
                  >
                    ดูประวัติใบเบิกทั้งหมด →
                  </button>
                </>
              )}

              {importStep === 'upload' && (
                <button
                  type="button"
                  onClick={handleCloseImportModal}
                  className="px-5 py-2.5 bg-gray-100 text-gray-750 font-extrabold rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      {/* Keyboard Shortcuts Guide Modal */}
      {isShortcutsGuideOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl w-full flex flex-col max-h-[85vh] animate-scale-up overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shadow-inner">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-950">คู่มือปุ่มลัดคีย์บอร์ด (Keyboard Shortcuts Guide)</h3>
                  <p className="text-[11px] text-gray-500 font-bold mt-0.5">ทำงานได้สะดวกรวดเร็วโดยไม่ต้องจับเมาส์</p>
                </div>
              </div>
              <button 
                onClick={() => setIsShortcutsGuideOpen(false)}
                className="p-1.5 hover:bg-gray-100 hover:text-gray-700 text-gray-400 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="bg-emerald-900 text-emerald-50 p-4.5 rounded-2xl space-y-1.5 shadow-md">
                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Pro Tip</span>
                <p className="font-extrabold text-sm">บันทึกเวชภัณฑ์ด่วนภายใน 5 วินาที</p>
                <p className="text-[11px] text-emerald-100/90 leading-relaxed font-semibold">
                  กด <kbd className="px-1.5 py-0.5 bg-emerald-800 rounded border border-emerald-700 text-[10px] font-mono text-emerald-100">Alt + A</kbd> เพื่อเพิ่มแถวใหม่ พิมพ์ค้นหาเวชภัณฑ์ กดลูกศรลง เลือกยาด้วย <kbd className="px-1.5 py-0.5 bg-emerald-800 rounded border border-emerald-700 text-[10px] font-mono text-emerald-100">Enter</kbd> แล้วพิมพ์จำนวนเบิกได้ทันที!
                </p>
              </div>

              {/* Shortcuts Table/Grid */}
              <div className="space-y-3 text-left">
                <h4 className="font-black text-gray-900 text-xs border-b border-gray-50 pb-1.5">ปุ่มที่ใช้บ่อยในตารางใบเบิก</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750 min-w-8 text-center shrink-0">Tab</kbd>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">เลื่อนไปเซลล์ขวา</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">ขยับโฟกัสไปยังคอลัมน์ถัดไป</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <div className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750">Shift</kbd>
                      <span className="text-gray-400 font-black">+</span>
                      <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-755">Tab</kbd>
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">เลื่อนย้อนกลับ (ซ้าย)</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">ขยับโฟกัสไปยังคอลัมน์ก่อนหน้า</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750 min-w-8 text-center shrink-0">Enter</kbd>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">ยืนยัน / เซลล์ถัดไป</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">เลื่อนโฟกัสทำงานคล้าย Tab (เหมาะกับ Numpad)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <div className="flex gap-1 shrink-0">
                      <kbd className="p-1 bg-white border border-gray-300 rounded shadow-sm text-gray-750 text-[10px] font-black">↑</kbd>
                      <kbd className="p-1 bg-white border border-gray-300 rounded shadow-sm text-gray-750 text-[10px] font-black">↓</kbd>
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">ขึ้น / ลง แถวตาราง</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">ขยับแถวโฟกัสไปแถวบนหรือล่างในตำแหน่งคอลัมน์เดิม</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750 shrink-0">Space</kbd>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">เปลี่ยนเวชภัณฑ์ใหม่</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">กดที่ช่องรายการเดิมเพื่อเปิดช่องค้นหายาขึ้นมาอีกครั้ง</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-755 shrink-0">Esc</kbd>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">ยกเลิก / ปิดสืบค้น</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">ปิดผลลัพธ์ดรอปดาวน์ยาหรือยกเลิกการแก้ไข</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-left">
                <h4 className="font-black text-gray-900 text-xs border-b border-gray-50 pb-1.5">คีย์ลัดสั่งงานเอกสาร (Global Commands)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <div className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750">Alt</kbd>
                      <span className="text-gray-400 font-black">+</span>
                      <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750">A</kbd>
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">เพิ่มรายการแถวใหม่</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">สร้างรายการแถวเพิ่มและเปิดช่องค้นหายาทันที</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
                    <div className="flex items-center gap-1 shrink-0">
                      <kbd className="px-1 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750">Alt</kbd>
                      <span className="text-gray-400 font-black">+</span>
                      <kbd className="px-1.5 py-1 bg-white border border-gray-300 rounded shadow-sm text-[10px] font-black text-gray-750">S</kbd>
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-gray-800">บันทึกใบเบิก (Submit)</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">ประเมินและส่งบันทึกฟอร์มโดยด่วน</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsShortcutsGuideOpen(false)}
                className="px-5 py-2.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 transition-all text-xs cursor-pointer shadow-md shadow-emerald-600/10"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

