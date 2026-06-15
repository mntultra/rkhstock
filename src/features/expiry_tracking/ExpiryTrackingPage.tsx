import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, AlertTriangle, Clock, Search, Filter, Plus, Calendar, X, CheckCircle, Printer, FileSpreadsheet, Pill } from 'lucide-react';
import AddManualExpiryModal from './AddManualExpiryModal';
import { formatDate } from '@/utils/dateUtils';
import { useWarehouses } from '@/hooks/useWarehouses';
import * as XLSX from 'xlsx';

interface ExpiryItem {
  id: string;
  source: 'SYSTEM' | 'MANUAL';
  generic_name: string;
  trade_name?: string;
  drug_code?: string;
  lot_number: string;
  expiry_date: string;
  qty: number | null;
  unit_name?: string;
  location: string;
  days_remaining: number;
  manufacturer?: string;
  remark?: string;
}

export default function ExpiryTrackingPage() {
  const { warehouses } = useWarehouses();
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Settings
  const [warningMonths, setWarningMonths] = useState(6); // Default

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SYSTEM' | 'MANUAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING' | 'SAFE'>('ALL');

  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as any).filter) {
      setStatusFilter((location.state as any).filter);
      // Clear navigation state so a reload doesn't lock the filter
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch organization settings
      const { data: orgData } = await supabase.from('organization_info').select('expiry_warning_months').limit(1);
      const months = orgData?.[0]?.expiry_warning_months ?? 6;
      setWarningMonths(months);

      // 2. Fetch System Stock (from stock_balances & lots)
      const { data: systemStock, error: sysError } = await supabase
        .from('stock_balances')
        .select(`
          id,
          current_qty,
          warehouse_id,
          products ( id, generic_name, trade_name, drug_code, pack_size, unit_id, master_units(unit_name) ),
          lots!inner ( lot_number, expiry_date )
        `)
        .gt('current_qty', 0)
        .not('lots.expiry_date', 'is', null);

      if (sysError) throw sysError;

      // 3. Fetch Manual Tracking
      const { data: manualStock, error: manError } = await supabase
        .from('manual_expirations')
        .select(`
          id,
          lot_number,
          expiry_date,
          qty,
          warehouse_id,
          manufacturer,
          remark,
          products ( id, generic_name, trade_name, drug_code, pack_size, unit_id, master_units(unit_name) )
        `);

      if (manError) throw manError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const combined: ExpiryItem[] = [];

      // Process System Stock
      systemStock?.forEach((item: any) => {
        const expDate = new Date(item.lots.expiry_date);
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const warehouseName = warehouses.find(w => w.id === item.warehouse_id)?.name || 'คลังหลัก';

        combined.push({
          id: `sys_${item.id}`,
          source: 'SYSTEM',
          generic_name: item.products?.generic_name || 'Unknown',
          trade_name: item.products?.trade_name,
          drug_code: item.products?.drug_code,
          lot_number: item.lots?.lot_number || '-',
          expiry_date: item.lots.expiry_date,
          qty: item.current_qty,
          unit_name: Array.isArray(item.products?.master_units) ? item.products?.master_units[0]?.unit_name : (item.products?.master_units?.unit_name || 'ชิ้น'),
          location: warehouseName,
          days_remaining: diffDays
        });
      });

      // Process Manual Stock
      manualStock?.forEach((item: any) => {
        const expDate = new Date(item.expiry_date);
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const warehouseName = warehouses.find(w => w.id === item.warehouse_id)?.name || 'ไม่ระบุสถานที่';

        combined.push({
          id: `man_${item.id}`,
          source: 'MANUAL',
          generic_name: item.products?.generic_name || 'Unknown',
          trade_name: item.products?.trade_name,
          drug_code: item.products?.drug_code,
          lot_number: item.lot_number || '-',
          expiry_date: item.expiry_date,
          qty: item.qty,
          unit_name: Array.isArray(item.products?.master_units) ? item.products?.master_units[0]?.unit_name : (item.products?.master_units?.unit_name || 'ชิ้น'),
          location: warehouseName,
          days_remaining: diffDays,
          manufacturer: item.manufacturer,
          remark: item.remark
        });
      });

      // Sort by expiry date (closest first)
      combined.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
      
      setItems(combined);
    } catch (err: any) {
      console.error('Error fetching expiry data:', err);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (warehouses.length > 0) {
      fetchData();
    }
  }, [warehouses]);

  // Filter Logic
  const filteredItems = useMemo(() => {
    const warningDays = warningMonths * 30; // Approx

    return items.filter(item => {
      // 1. Search text
      if (search) {
        const query = search.toLowerCase();
        const matchName = item.generic_name.toLowerCase().includes(query) || (item.trade_name?.toLowerCase().includes(query));
        const matchCode = item.drug_code?.toLowerCase().includes(query);
        const matchLot = item.lot_number?.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchLot) return false;
      }

      // 2. Source filter
      if (sourceFilter !== 'ALL' && item.source !== sourceFilter) return false;

      // 3. Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'EXPIRED' && item.days_remaining > 0) return false;
        if (statusFilter === 'WARNING' && (item.days_remaining <= 0 || item.days_remaining > warningDays)) return false;
        if (statusFilter === 'SAFE' && item.days_remaining <= warningDays) return false;
      }

      return true;
    });
  }, [items, search, sourceFilter, statusFilter, warningMonths]);

  const getStatusDisplay = (days: number) => {
    const warningDays = warningMonths * 30;
    
    if (days < 0) {
      return {
        label: `หมดอายุแล้ว ${Math.abs(days)} วัน`,
        bg: 'bg-red-50 text-red-700 border-red-200',
        icon: <ShieldAlert size={16} className="text-red-500" />
      };
    } else if (days === 0) {
      return {
        label: 'หมดอายุวันนี้',
        bg: 'bg-red-50 text-red-700 border-red-200',
        icon: <ShieldAlert size={16} className="text-red-500" />
      };
    } else if (days <= warningDays) {
      return {
        label: `เหลือ ${days} วัน`,
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: <AlertTriangle size={16} className="text-orange-500" />
      };
    } else {
      return {
        label: `เหลือ ${days} วัน`,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <Clock size={16} className="text-emerald-500" />
      };
    }
  };

  const handleManualDelete = async (id: string) => {
    if (!confirm('ยืนยันลบรายการติดตามยานี้?')) return;
    const realId = id.replace('man_', '');
    try {
      const { error } = await supabase.from('manual_expirations').delete().eq('id', realId);
      if (error) throw error;
      fetchData(); // Refresh
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  // 1. Calculate Summary Stats for Dashboard
  const stats = useMemo(() => {
    const warningDays = warningMonths * 30;
    let total = items.length;
    let expired = 0;
    let warning = 0;
    let safe = 0;
    let systemCount = 0;
    let manualCount = 0;

    items.forEach(item => {
      if (item.days_remaining <= 0) {
        expired++;
      } else if (item.days_remaining <= warningDays) {
        warning++;
      } else {
        safe++;
      }

      if (item.source === 'SYSTEM') {
        systemCount++;
      } else if (item.source === 'MANUAL') {
        manualCount++;
      }
    });

    return { total, expired, warning, safe, systemCount, manualCount };
  }, [items, warningMonths]);

  // 2. Compute SVG segments for Drug Status Donut Chart (Radius = 38, Circumference = 238.76)
  const statusSegments = useMemo(() => {
    const total = stats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'SAFE', value: stats.safe, color: '#10b981', label: 'ปลอดภัย', filterVal: 'SAFE' },
      { key: 'WARNING', value: stats.warning, color: '#f59e0b', label: 'ใกล้หมดอายุ', filterVal: 'WARNING' },
      { key: 'EXPIRED', value: stats.expired, color: '#f43f5e', label: 'หมดอายุแล้ว', filterVal: 'EXPIRED' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 38;
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [stats]);

  // 3. Compute SVG segments for Location Donut Chart
  const locationSegments = useMemo(() => {
    const total = stats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'MANUAL', value: stats.manualCount, color: '#d946ef', label: 'ชั้นจุดจ่าย', filterVal: 'MANUAL' },
      { key: 'SYSTEM', value: stats.systemCount, color: '#3b82f6', label: 'สต๊อก', filterVal: 'SYSTEM' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 38;
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [stats]);

  // 4. Excel Export Function
  const handleExportExcel = () => {
    const data = filteredItems.map(item => ({
      'เวชภัณฑ์': item.generic_name,
      'ชื่อการค้า': item.trade_name || '',
      'รหัสเวชภัณฑ์': item.drug_code || '',
      'แหล่งข้อมูล': item.source === 'SYSTEM' ? 'คลังเวชภัณฑ์ (In-Stock)' : 'ชั้นจุดจ่าย (Manual Tracking)',
      'สถานที่': item.location,
      'เลขล็อต': item.lot_number,
      'วันหมดอายุ': item.expiry_date,
      'วันคงเหลือ': item.days_remaining <= 0 ? `หมดอายุแล้ว ${Math.abs(item.days_remaining)} วัน` : `${item.days_remaining} วัน`,
      'จำนวนคงเหลือ': item.qty ?? 0,
      'หน่วยนับ': item.unit_name || '',
      'ผู้ผลิต': item.manufacturer || '',
      'หมายเหตุ': item.remark || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expiry_Report');
    XLSX.writeFile(workbook, `RKH_Expiry_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden animate-fade-in-up print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-inner">
              <Calendar size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1">จัดการยาใกล้หมดอายุ</h1>
              <p className="text-red-100 font-medium text-sm">ติดตามเวชภัณฑ์ใกล้หมดอายุทั้งในคลังและบนชั้นจุดจ่าย (แจ้งเตือนล่วงหน้า {warningMonths} เดือน)</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-5 py-3 rounded-xl font-bold hover:bg-white/20 hover:scale-105 transition-all shadow-md cursor-pointer"
            >
              <Printer size={18} />
              พิมพ์รายงาน
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 hover:scale-105 transition-all shadow-md cursor-pointer"
            >
              <FileSpreadsheet size={18} />
              ส่งออก Excel
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 hover:scale-105 transition-all shadow-md cursor-pointer"
            >
              <Plus size={20} strokeWidth={3} />
              เพิ่มรายการยาที่ชั้นจุดจ่าย
            </button>
          </div>
        </div>
      </div>

      {/* Expiry Dashboard Overview (Print Hidden) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 animate-fade-in-up print:hidden">
        {/* KPI Cards on the Left (4 cols) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-4">
          {/* Card 1: All Items */}
          <div 
            onClick={() => { setStatusFilter('ALL'); setSourceFilter('ALL'); }}
            className={`cursor-pointer bg-white rounded-2xl p-5 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              statusFilter === 'ALL' && sourceFilter === 'ALL' ? 'border-gray-950 ring-4 ring-gray-950/10 scale-[1.02] shadow-md' : 'border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start text-gray-400">
              <span className="text-[11px] font-black uppercase tracking-wider">ยาทั้งหมด</span>
              <Pill size={16} />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-gray-900">{stats.total}</span>
              <span className="text-[11px] text-gray-500 font-bold block mt-1">รายการยาในระบบ</span>
            </div>
          </div>

          {/* Card 2: Expired */}
          <div 
            onClick={() => setStatusFilter('EXPIRED')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              statusFilter === 'EXPIRED' ? 'border-red-600 ring-4 ring-red-600/15 scale-[1.02] shadow-md' : 'border-red-500/80'
            }`}
          >
            <div className="flex justify-between items-start text-red-500">
              <span className="text-[11px] font-black uppercase tracking-wider">หมดอายุแล้ว</span>
              <ShieldAlert size={16} />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-red-600">{stats.expired}</span>
              <span className="text-[11px] text-red-500 font-bold block mt-1">ต้องจัดการทำลาย/บริจาค</span>
            </div>
          </div>

          {/* Card 3: Near Expiry */}
          <div 
            onClick={() => setStatusFilter('WARNING')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              statusFilter === 'WARNING' ? 'border-orange-500 ring-4 ring-orange-500/15 scale-[1.02] shadow-md' : 'border-orange-400/80'
            }`}
          >
            <div className="flex justify-between items-start text-orange-500">
              <span className="text-[11px] font-black uppercase tracking-wider">ใกล้หมดอายุ</span>
              <Clock size={16} />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-orange-600">{stats.warning}</span>
              <span className="text-[11px] text-orange-500 font-bold block mt-1">หมดอายุภายใน {warningMonths * 30} วัน</span>
            </div>
          </div>

          {/* Card 4: Safe */}
          <div 
            onClick={() => setStatusFilter('SAFE')}
            className={`cursor-pointer bg-white rounded-2xl p-5 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              statusFilter === 'SAFE' ? 'border-emerald-500 ring-4 ring-emerald-500/15 scale-[1.02] shadow-md' : 'border-emerald-450/80'
            }`}
          >
            <div className="flex justify-between items-start text-emerald-500">
              <span className="text-[11px] font-black uppercase tracking-wider">ปลอดภัย</span>
              <CheckCircle size={16} />
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-emerald-600">{stats.safe}</span>
              <span className="text-[11px] text-emerald-500 font-bold block mt-1">ยาที่มีสภาพพร้อมใช้</span>
            </div>
          </div>
        </div>

        {/* Donut Chart 1: สถานะยา (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[200px]">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-gray-900 text-sm">สถานะยา</span>
          </div>
          
          <div className="flex items-center justify-center h-32 relative my-2">
            {stats.total === 0 ? (
              <div className="text-gray-400 text-xs font-medium">ไม่มีข้อมูล</div>
            ) : (
              <>
                <svg className="w-28 h-28 transform -rotate-90">
                  {statusSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="56"
                      cy="56"
                      r="38"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="10"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-300 hover:stroke-[12px] cursor-pointer"
                      onClick={() => setStatusFilter(seg.filterVal as any)}
                    />
                  ))}
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center gap-4 text-[11px] font-bold mt-1 flex-wrap">
            <span className={`flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition-colors ${statusFilter === 'SAFE' ? 'text-emerald-600 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('SAFE')}>
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span> ปลอดภัย
            </span>
            <span className={`flex items-center gap-1.5 cursor-pointer hover:text-rose-600 transition-colors ${statusFilter === 'EXPIRED' ? 'text-rose-600 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('EXPIRED')}>
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span> หมดอายุแล้ว
            </span>
            <span className={`flex items-center gap-1.5 cursor-pointer hover:text-amber-500 transition-colors ${statusFilter === 'WARNING' ? 'text-amber-500 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('WARNING')}>
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span> ใกล้หมดอายุ
            </span>
          </div>
        </div>

        {/* Donut Chart 2: จำนวนยาแยกตามจุดจัดเก็บ (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[200px]">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-gray-900 text-sm">จำนวนยาแยกตามจุดจัดเก็บ</span>
          </div>

          <div className="flex items-center justify-center h-32 relative my-2">
            {stats.total === 0 ? (
              <div className="text-gray-400 text-xs font-medium">ไม่มีข้อมูล</div>
            ) : (
              <>
                <svg className="w-28 h-28 transform -rotate-90">
                  {locationSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="56"
                      cy="56"
                      r="38"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="10"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-300 hover:stroke-[12px] cursor-pointer"
                      onClick={() => setSourceFilter(seg.filterVal as any)}
                    />
                  ))}
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center gap-6 text-[11px] font-bold mt-1 flex-wrap">
            <span className={`flex items-center gap-1.5 cursor-pointer hover:text-fuchsia-600 transition-colors ${sourceFilter === 'MANUAL' ? 'text-fuchsia-600 scale-105' : 'text-gray-500'}`} onClick={() => setSourceFilter('MANUAL')}>
              <span className="w-2.5 h-2.5 rounded bg-fuchsia-500 inline-block"></span> ชั้นจุดจ่าย
            </span>
            <span className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors ${sourceFilter === 'SYSTEM' ? 'text-blue-600 scale-105' : 'text-gray-500'}`} onClick={() => setSourceFilter('SYSTEM')}>
              <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span> สต๊อก
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between animate-fade-in-up print:hidden" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหายา, เลขล็อต..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-red-100 focus:border-red-400 transition-all text-sm font-bold"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter size={18} className="text-gray-400 shrink-0" />
          
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-red-400 text-sm font-bold text-gray-700"
          >
            <option value="ALL">แหล่งข้อมูล: ทั้งหมด</option>
            <option value="SYSTEM">เฉพาะในคลัง (ระบบ rkhstock)</option>
            <option value="MANUAL">เฉพาะบนชั้นจุดจ่าย (เพิ่มเอง)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-red-400 text-sm font-bold text-gray-700"
          >
            <option value="ALL">สถานะ: ทั้งหมด</option>
            <option value="EXPIRED">หมดอายุแล้ว</option>
            <option value="WARNING">ใกล้หมดอายุ</option>
            <option value="SAFE">ปกติ (ยังไม่หมดอายุ)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">เวชภัณฑ์</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">สถานที่ (คลัง/จุดจ่าย)</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">แหล่งข้อมูล</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">เลขล็อต</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-center">วันหมดอายุ</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">เวลาที่เหลือ</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">จำนวน</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider w-16 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="w-10 h-10 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">กำลังโหลดข้อมูลการหมดอายุ...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500">
                    <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
                    <p className="text-lg font-bold text-gray-700">ไม่พบรายการเวชภัณฑ์</p>
                    <p className="text-sm mt-1">ลองเปลี่ยนเงื่อนไขการกรอง หรือเพิ่มรายการยาที่ชั้นจุดจ่าย</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const status = getStatusDisplay(item.days_remaining);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-gray-900 text-sm">{item.generic_name}</span>
                          <span className="text-xs text-gray-500 font-medium">รหัส: {item.drug_code || '-'}</span>
                          {(item.manufacturer || item.remark) && (
                            <div className="flex flex-col mt-1 gap-0.5">
                              {item.manufacturer && <span className="text-[10px] text-emerald-600 font-bold">บ. {item.manufacturer}</span>}
                              {item.remark && <span className="text-[10px] text-gray-400 font-medium">หมายเหตุ: {item.remark}</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-gray-700 text-sm bg-gray-100 px-3 py-1 rounded-lg">
                          {item.location}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.source === 'SYSTEM' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            IN-STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            MANUAL TRACK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono text-sm font-medium text-gray-600">
                          {item.lot_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-gray-900 text-sm">
                          {formatDate(item.expiry_date)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`inline-flex items-center justify-end gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold shadow-sm ${status.bg}`}>
                          {status.icon}
                          {status.label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-gray-900">{item.qty !== null ? item.qty : '-'}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{item.unit_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.source === 'MANUAL' ? (
                          <button
                            onClick={() => handleManualDelete(item.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="ลบรายการติดตามยานี้"
                          >
                            <X size={18} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold block" title="ไม่สามารถลบจากหน้านี้ได้ ต้องทำเรื่องตัดจ่ายยา">ระบบ</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <AddManualExpiryModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
