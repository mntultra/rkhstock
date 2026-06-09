import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Search, Filter, ClipboardList, ArrowRight, CalendarDays, ChevronRight, Calendar, X, Printer, Edit } from 'lucide-react';

export default function RequisitionHistory() {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('ALL');

  // States for Requisition Details Modal
  const [selectedRequisition, setSelectedRequisition] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // States for Requisition Details Column Filtering
  const [codeFilter, setCodeFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [showCodeFilter, setShowCodeFilter] = useState(false);
  const [showNameFilter, setShowNameFilter] = useState(false);
  const [showFormFilter, setShowFormFilter] = useState(false);

  // 1. ดึงข้อมูลปีงบประมาณทั้งหมดเมื่อ mount
  useEffect(() => {
    const fetchFiscalYears = async () => {
      try {
        const { data, error } = await supabase
          .from('master_fiscal_years')
          .select('id, year_name, is_active')
          .order('year_name', { ascending: false });
        if (error) throw error;
        if (data) {
          setFiscalYears(data);
          const activeYear = data.find(fy => fy.is_active);
          if (activeYear) {
            setSelectedFiscalYear(activeYear.id);
          }
        }
      } catch (err) {
        console.error('Error fetching fiscal years in requisitions:', err);
      }
    };
    fetchFiscalYears();
  }, []);

  // 2. ดึงข้อมูลใบเบิก
  const fetchRequisitions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('requisitions')
        .select(`
          id, doc_no, doc_date, status, created_at, fiscal_year_id, remarks,
          requester:officers!requester_id(full_name, position),
          approver:officers!approver_id(full_name, position),
          requisition_items(qty)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      if (selectedFiscalYear !== 'ALL') {
        query = query.eq('fiscal_year_id', selectedFiscalYear);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setRequisitions(data || []);
    } catch (err: any) {
      alert("โหลดประวัติใบเบิกไม่สำเร็จ: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, [statusFilter, selectedFiscalYear]);

  // Client-side search filtering
  const filteredRequisitions = requisitions.filter(req => {
    const docNoMatch = req.doc_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const requesterMatch = req.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return searchTerm === '' || docNoMatch || requesterMatch;
  });

  // Modal Handlers
  const handleOpenDetails = async (req: any) => {
    setSelectedRequisition(req);
    setIsDetailsModalOpen(true);
    setIsModalLoading(true);
    
    // Reset filters
    setCodeFilter('');
    setNameFilter('');
    setFormFilter('');
    setShowCodeFilter(false);
    setShowNameFilter(false);
    setShowFormFilter(false);

    try {
      const { data, error } = await supabase
        .from('requisition_items')
        .select(`
          id, qty, pack_size, unit_name, remarks, substock_qty, usage_rate,
          product:products (
            drug_code, generic_name, trade_name,
            master_units(name:unit_name),
            master_dosage_forms(name_en, abbreviation)
          )
        `)
        .eq('requisition_id', req.id);
      
      // Sort by dosage form name
      if (data) {
        data.sort((a: any, b: any) => {
          const df_a = (a.product?.master_dosage_forms?.name_en || '');
          const df_b = (b.product?.master_dosage_forms?.name_en || '');
          return df_a.localeCompare(df_b);
        });
      }
      
      if (error) throw error;
      setModalItems(data || []);
    } catch (err: any) {
      alert("โหลดรายละเอียดใบเบิกไม่สำเร็จ: " + err.message);
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setSelectedRequisition(null);
    setModalItems([]);
    
    // Reset filters
    setCodeFilter('');
    setNameFilter('');
    setFormFilter('');
    setShowCodeFilter(false);
    setShowNameFilter(false);
    setShowFormFilter(false);
  };

  const filteredModalItems = modalItems.filter(item => {
    const code = (item.product?.drug_code || '').toLowerCase();
    const name = (item.product?.generic_name || '').toLowerCase();
    const trade = (item.product?.trade_name || '').toLowerCase();
    const form = (item.product?.master_dosage_forms?.abbreviation || item.product?.master_dosage_forms?.name_en || '').toLowerCase();

    const codeMatch = code.includes(codeFilter.toLowerCase());
    const nameMatch = name.includes(nameFilter.toLowerCase()) || trade.includes(nameFilter.toLowerCase());
    const formMatch = form.includes(formFilter.toLowerCase());

    return codeMatch && nameMatch && formMatch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs border border-gray-200">ฉบับร่าง</span>;
      case 'PENDING':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-bold text-xs border border-amber-200 animate-pulse">ส่งใบเบิกแล้ว</span>;

      case 'COMPLETED':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs border border-emerald-200">ได้รับของแล้ว</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg font-bold text-xs border border-red-200">ไม่อนุมัติ/ยกเลิก</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold text-xs">{status}</span>;
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in-up font-sans select-none">
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">ประวัติใบเบิกเวชภัณฑ์</h1>
            <p className="text-gray-500 font-medium">ค้นหา ติดตามสถานะ และดูรายละเอียดใบเบิกเวชภัณฑ์ย้อนหลังทั้งหมด</p>
          </div>
        </div>
        <Link 
          to="/requisition/new" 
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          ขอเบิกเวชภัณฑ์ใหม่ <ArrowRight size={18} />
        </Link>
      </div>

      <div className="glass p-6 rounded-3xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* ช่องค้นหา */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="ค้นหาเลขที่เอกสาร หรือชื่อผู้เบิก..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
            />
          </div>

          {/* กรองปีงบประมาณ */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <select
              value={selectedFiscalYear}
              onChange={e => setSelectedFiscalYear(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700 appearance-none transition-all text-sm cursor-pointer"
            >
              <option value="ALL">ปีงบประมาณทั้งหมด (All Years)</option>
              {fiscalYears.map(fy => (
                <option key={fy.id} value={fy.id}>
                  ปีงบประมาณ {fy.year_name} {fy.is_active ? '(ปัจจุบัน)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* กรองสถานะและปุ่มรีเฟรช */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700 appearance-none transition-all text-sm cursor-pointer"
              >
                <option value="ALL">ทุกสถานะ (All Status)</option>
                <option value="DRAFT">ฉบับร่าง (Draft)</option>
                <option value="PENDING">ส่งใบเบิกแล้ว (Sent)</option>
                <option value="COMPLETED">ได้รับของแล้ว (Completed)</option>
                <option value="REJECTED">ยกเลิก/ไม่อนุมัติ (Cancelled)</option>
              </select>
            </div>
            <button 
              onClick={fetchRequisitions}
              className="px-4 py-3 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl font-bold transition-all text-sm"
            >
              รีเฟรช
            </button>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-indigo-900/5 overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 font-extrabold uppercase tracking-wider text-xs border-b border-gray-100">
                <th className="p-4 w-32">วันที่เบิก</th>
                <th className="p-4">เลขที่เอกสาร</th>
                <th className="p-4">ผู้ขอเบิก</th>
                <th className="p-4">ผู้อนุมัติ/ผู้จ่าย</th>
                <th className="p-4 text-center">จำนวนรายการ</th>
                <th className="p-4 text-center">สถานะ</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-400">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="font-bold">กำลังโหลดประวัติใบเบิก...</p>
                  </td>
                </tr>
              ) : filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-400 font-medium">
                    ไม่พบข้อมูลใบเบิกที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredRequisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="p-4 text-gray-500 font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-gray-400" />
                        {formatDate(req.doc_date)}
                      </div>
                    </td>
                    <td className="p-4 font-mono font-black text-indigo-900">
                      {req.doc_no || 'ยังไม่ออกเลข (DRAFT)'}
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      {req.requester?.full_name || '-'}
                    </td>
                    <td className="p-4 text-gray-600 font-medium">
                      {req.approver?.full_name || '-'}
                    </td>
                    <td className="p-4 text-center font-extrabold text-gray-600">
                      {req.requisition_items?.length || 0}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {req.status === 'DRAFT' && (
                          <Link
                            to={`/requisition/edit/${req.id}`}
                            className="inline-flex items-center justify-center p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all cursor-pointer"
                            title="แก้ไขใบเบิก"
                          >
                            <Edit size={18} />
                          </Link>
                        )}
                        <button 
                          onClick={() => handleOpenDetails(req)}
                          className="inline-flex items-center justify-center p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                          title="ดูรายละเอียดใบเบิก"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailsModalOpen && selectedRequisition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-extrabold text-gray-900">
                  รายละเอียดใบเบิก: {selectedRequisition.doc_no || 'ยังไม่ออกเลข (DRAFT)'}
                </h2>
                {getStatusBadge(selectedRequisition.status)}
                
                {selectedRequisition.status === 'DRAFT' && (
                  <div className="flex gap-2 ml-2">
                    <Link
                      to={`/requisition/edit/${selectedRequisition.id}`}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 cursor-pointer"
                    >
                      แก้ไขใบเบิก (Edit)
                    </Link>
                    <button
                      onClick={async () => {
                        if (confirm(`ยืนยันการส่งใบเบิก ${selectedRequisition.doc_no || 'DRAFT'} ไปยังคลังหลัก? สถานะจะเปลี่ยนเป็น "ส่งใบเบิกแล้ว"`)) {
                          try {
                            const { error } = await supabase
                              .from('requisitions')
                              .update({ status: 'PENDING' })
                              .eq('id', selectedRequisition.id);
                            if (error) throw error;
                            setSelectedRequisition((prev: any) => prev ? { ...prev, status: 'PENDING' } : null);
                            fetchRequisitions();
                            alert('อัพเดทสถานะสำเร็จ!');
                          } catch (err: any) {
                            alert('อัพเดทสถานะไม่สำเร็จ: ' + err.message);
                          }
                        }
                      }}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 cursor-pointer"
                    >
                      ส่งใบเบิก (Send)
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`ยืนยันการยกเลิกใบเบิก ${selectedRequisition.doc_no || 'DRAFT'} หรือไม่? สถานะจะถูกเปลี่ยนเป็น "ยกเลิก"`)) {
                          try {
                            const { error } = await supabase
                              .from('requisitions')
                              .update({ status: 'REJECTED' })
                              .eq('id', selectedRequisition.id);
                            if (error) throw error;
                            setSelectedRequisition((prev: any) => prev ? { ...prev, status: 'REJECTED' } : null);
                            fetchRequisitions();
                            alert('ยกเลิกใบเบิกสำเร็จ!');
                          } catch (err: any) {
                            alert('ยกเลิกใบเบิกไม่สำเร็จ: ' + err.message);
                          }
                        }
                      }}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 cursor-pointer"
                    >
                      ยกเลิก (Cancel)
                    </button>
                  </div>
                )}
                
                {selectedRequisition.status !== 'DRAFT' && (
                  <button
                    onClick={async () => {
                      if (confirm(`ต้องการเปลี่ยนสถานะใบเบิก ${selectedRequisition.doc_no} กลับเป็น "ฉบับร่าง (DRAFT)" หรือไม่?`)) {
                        try {
                          const { error } = await supabase
                            .from('requisitions')
                            .update({ status: 'DRAFT' })
                            .eq('id', selectedRequisition.id);
                          
                          if (error) throw error;
                          
                          setSelectedRequisition((prev: any) => prev ? { ...prev, status: 'DRAFT' } : null);
                          fetchRequisitions();
                          alert('เปลี่ยนสถานะเป็นฉบับร่างสำเร็จเรียบร้อย!');
                        } catch (err: any) {
                          alert('เปลี่ยนสถานะไม่สำเร็จ: ' + err.message);
                        }
                      }
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 cursor-pointer ml-2"
                  >
                    เปลี่ยนเป็นร่าง (DRAFT)
                  </button>
                )}
              </div>
              <button 
                onClick={handleCloseDetails}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 bg-gray-50 overflow-y-auto flex-1 flex flex-col gap-6">
              {isModalLoading ? (
                <div className="py-20 text-center text-gray-400 w-full">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="font-bold">กำลังโหลดรายการเวชภัณฑ์...</p>
                </div>
              ) : modalItems.length === 0 ? (
                <div className="py-20 text-center text-gray-400 font-medium w-full">
                  ไม่พบรายการเวชภัณฑ์ในใบเบิกนี้
                </div>
              ) : (
                <>
                  {/* Metadata Cards Grid (ส่วนหัว) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                      <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">เลขที่เอกสาร / วันที่</span>
                      <span className="font-mono font-black text-indigo-900 mt-1 text-sm">{selectedRequisition.doc_no || 'ยังไม่ออกเลข (DRAFT)'}</span>
                      <span className="text-xs text-gray-500 font-semibold mt-0.5">
                        วันที่: {formatDate(selectedRequisition.doc_date)}
                      </span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                      <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">ผู้ขอเบิก (Requester)</span>
                      <span className="font-extrabold text-gray-800 mt-1 text-sm">{selectedRequisition.requester?.full_name || '-'}</span>
                      <span className="text-xs text-gray-500 font-semibold mt-0.5">ตำแหน่ง: {selectedRequisition.requester?.position || '-'}</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                      <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">ผู้อนุมัติ/ผู้จ่าย (Approver)</span>
                      <span className="font-extrabold text-gray-800 mt-1 text-sm">{selectedRequisition.approver?.full_name || '-'}</span>
                      <span className="text-xs text-gray-500 font-semibold mt-0.5">ตำแหน่ง: {selectedRequisition.approver?.position || '-'}</span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                      <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">ปีงบประมาณ & หมายเหตุ</span>
                      <span className="font-extrabold text-gray-700 mt-1 text-xs">
                        ปีงบประมาณ: {fiscalYears.find(fy => fy.id === selectedRequisition.fiscal_year_id)?.year_name || '-'}
                      </span>
                      {selectedRequisition.remarks ? (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg font-semibold mt-1 self-start truncate max-w-full" title={selectedRequisition.remarks}>
                          {selectedRequisition.remarks}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic mt-1">-</span>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar (สรุปจำนวน รายการที่ขอเบิก) */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/10 rounded-xl">
                        <ClipboardList size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg">สรุปรายการขอเบิกเวชภัณฑ์</h3>
                        <p className="text-white/80 text-xs font-semibold">แสดงผลรายการเวชภัณฑ์ทั้งหมดที่ระบุในใบเบิกนี้</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 sm:gap-8 items-center text-center">
                      <div>
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider block">รายการทั้งหมด</span>
                        <span className="text-2xl font-black">{modalItems.length} <span className="text-xs font-bold">รายการ</span></span>
                      </div>
                      <div className="w-[1px] h-8 bg-white/20" />
                      <div>
                        <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider block">จำนวนขอเบิกรวม</span>
                        <span className="text-2xl font-black">
                          {modalItems.reduce((sum, item) => sum + Number(item.qty || 0), 0).toLocaleString('th-TH')}{' '}
                          <span className="text-xs font-bold">หน่วย</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table with filtering headers */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col shrink-0">
                    
                    {/* Active Filter Indicators */}
                    {(codeFilter || nameFilter || formFilter) && (
                      <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap text-xs text-indigo-800 font-bold">
                          <span>กำลังกรองข้อมูล:</span>
                          {codeFilter && <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">รหัส: "{codeFilter}"</span>}
                          {nameFilter && <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">ชื่อ: "{nameFilter}"</span>}
                          {formFilter && <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">รูปแบบ: "{formFilter}"</span>}
                        </div>
                        <button 
                          onClick={() => {
                            setCodeFilter('');
                            setNameFilter('');
                            setFormFilter('');
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
                        >
                          ล้างตัวกรองทั้งหมด
                        </button>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider text-xs border-b border-gray-100 select-none">
                            <th className="p-4 w-12 text-center">#</th>
                            
                            {/* Clickable Code Filter Header */}
                            <th 
                              className="p-4 w-32 cursor-pointer hover:bg-gray-100 transition-colors relative"
                              onClick={() => setShowCodeFilter(!showCodeFilter)}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1">
                                  <span>รหัสยา</span>
                                  <Filter size={12} className={codeFilter ? 'text-indigo-600' : 'text-gray-400'} />
                                </div>
                                {showCodeFilter && (
                                  <input
                                    type="text"
                                    value={codeFilter}
                                    onChange={(e) => setCodeFilter(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="ค้นหารหัส..."
                                    className="w-full text-[11px] px-2 py-1 bg-white border border-gray-300 rounded font-normal text-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50"
                                    autoFocus
                                  />
                                )}
                              </div>
                            </th>

                            {/* Clickable Name Filter Header */}
                            <th 
                              className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => setShowNameFilter(!showNameFilter)}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1">
                                  <span>รายการเวชภัณฑ์ (Generic Name)</span>
                                  <Filter size={12} className={nameFilter ? 'text-indigo-600' : 'text-gray-400'} />
                                </div>
                                {showNameFilter && (
                                  <input
                                    type="text"
                                    value={nameFilter}
                                    onChange={(e) => setNameFilter(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="ค้นหาชื่อเวชภัณฑ์..."
                                    className="w-full text-[11px] px-2 py-1 bg-white border border-gray-300 rounded font-normal text-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50"
                                    autoFocus
                                  />
                                )}
                              </div>
                            </th>

                            {/* Clickable Form Filter Header */}
                            <th 
                              className="p-4 w-32 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => setShowFormFilter(!showFormFilter)}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1 text-center justify-center">
                                  <span>รูปแบบ</span>
                                  <Filter size={12} className={formFilter ? 'text-indigo-600' : 'text-gray-400'} />
                                </div>
                                {showFormFilter && (
                                  <input
                                    type="text"
                                    value={formFilter}
                                    onChange={(e) => setFormFilter(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder="ค้นหารูปแบบ..."
                                    className="w-full text-[11px] px-2 py-1 bg-white border border-gray-300 rounded font-normal text-black outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 text-center"
                                    autoFocus
                                  />
                                )}
                              </div>
                            </th>

                            <th className="p-4 w-24 text-right">คงคลังเดิม</th>
                            <th className="p-4 w-24 text-right">อัตราการใช้</th>
                            <th className="p-4 w-28 text-right text-indigo-600 font-bold">จำนวนขอเบิก</th>
                            <th className="p-4 w-28 text-center">หน่วยบรรจุ</th>
                            <th className="p-4">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredModalItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-gray-400 font-medium">
                                ไม่พบรายการเวชภัณฑ์ที่ตรงกับตัวกรอง
                              </td>
                            </tr>
                          ) : (
                            filteredModalItems.map((item, index) => (
                              <tr key={item.id} className="hover:bg-indigo-50/20 transition-colors">
                                <td className="p-4 text-center font-bold text-gray-400">{index + 1}</td>
                                <td className="p-4 font-mono font-bold text-gray-700">{item.product?.drug_code || '-'}</td>
                                <td className="p-4">
                                  <div className="font-extrabold text-gray-900">{item.product?.generic_name}</div>
                                  {item.product?.trade_name && (
                                    <div className="text-[11px] text-gray-400 font-bold mt-0.5">
                                      Trade: {item.product.trade_name}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 text-center">
                                  {item.product?.master_dosage_forms?.abbreviation || item.product?.master_dosage_forms?.name_en ? (
                                    <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg uppercase">
                                      {item.product?.master_dosage_forms?.abbreviation || item.product?.master_dosage_forms?.name_en}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="p-4 text-right font-bold text-gray-600">{item.substock_qty ?? 0}</td>
                                <td className="p-4 text-right font-bold text-gray-600">{item.usage_rate ?? 0}</td>
                                <td className="p-4 text-right font-black text-emerald-600 bg-emerald-50/20 text-base">
                                  {item.qty?.toLocaleString('th-TH') || 0}
                                </td>
                                <td className="p-4 text-center font-bold text-gray-700">
                                  {item.pack_size === 1 || !item.pack_size ? '' : `x${item.pack_size} `}
                                  {item.product?.master_units?.name || item.unit_name || '-'}
                                </td>
                                <td className="p-4 text-gray-500 font-medium whitespace-pre-wrap max-w-xs truncate" title={item.remarks}>
                                  {item.remarks || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3">
              <button 
                onClick={handleCloseDetails}
                className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm transition-colors text-sm cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              
              <Link 
                to={`/requisition/print/${selectedRequisition.id}`}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 text-sm"
              >
                <Printer size={16} /> พิมพ์ใบขอเบิกเวชภัณฑ์
              </Link>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
