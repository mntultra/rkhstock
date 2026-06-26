import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, AlertCircle, Download, Printer, ArrowUpDown, Boxes, AlertTriangle, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InventoryAnalysisItem {
  product_id: string;
  drug_code: string;
  generic_name: string;
  unit_name: string;
  period_month: string;
  ending_stock: number;
  unit_price: number;
  stock_value: number;
  total_issued: number;
  avg_monthly_usage: number;
  months_of_stock: number;
}

type StatusFilter = 'ALL' | 'UNDERSTOCK' | 'OPTIMAL' | 'OVERSTOCK' | 'DEAD_STOCK';

export default function InventoryAnalysisReport() {
  const [items, setItems] = useState<InventoryAnalysisItem[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<1 | 3 | 5 | 9 | 12>(3);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // YYYY-MM
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryAnalysisItem; direction: 'asc' | 'desc' } | null>({
    key: 'generic_name',
    direction: 'asc'
  });

  // 1. โหลดข้อมูลจากการรัน RPC function บนฐานข้อมูล
  useEffect(() => {
    const fetchAnalysisData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .rpc('get_monthly_inventory_analysis', { 
            p_period_month: `${selectedPeriod}-01`,
            p_usage_months: selectedMonths 
          });
          
        if (fetchErr) throw fetchErr;
        if (data) {
          setItems(data.map((item: any) => ({
            product_id: item.product_id,
            drug_code: item.drug_code,
            generic_name: item.generic_name,
            unit_name: item.unit_name,
            period_month: item.period_month,
            ending_stock: Number(item.ending_stock) || 0,
            unit_price: Number(item.unit_price) || 0,
            stock_value: Number(item.stock_value) || 0,
            total_issued: Number(item.total_issued) || 0,
            avg_monthly_usage: Number(item.avg_monthly_usage) || 0,
            months_of_stock: Number(item.months_of_stock) || 0
          })));
        }
      } catch (err: any) {
        console.error('Error fetching inventory analysis:', err);
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalysisData();
  }, [selectedMonths, selectedPeriod]);

  // 2. คำนวณหาเกณฑ์ประเมินสำหรับแต่ละไอเท็มตามเกณฑ์ของผู้ใช้
  // - สำรองต่ำวิกฤต (Understock): MOS < 1.0 (และมียอดจ่ายออกมากกว่า 0)
  // - สำรองปกติ (Optimal): MOS 1.0 - 2.0 (และมียอดจ่ายออกมากกว่า 0)
  // - สำรองเกินต้องการ (Overstock): MOS > 2.0 และไม่ใช่ 999.99 (และมียอดจ่ายออกมากกว่า 0)
  // - ไม่มีการเคลื่อนไหว (Dead Stock): ยอดจ่ายสะสม = 0 หรือ MOS = 999.99
  const itemsWithStatus = useMemo(() => {
    return items.map(item => {
      let status: 'UNDERSTOCK' | 'OPTIMAL' | 'OVERSTOCK' | 'DEAD_STOCK' = 'OPTIMAL';
      
      if (item.total_issued === 0 || item.months_of_stock === 999.99) {
        status = 'DEAD_STOCK';
      } else if (item.months_of_stock < 1.0) {
        status = 'UNDERSTOCK';
      } else if (item.months_of_stock > 2.0) {
        status = 'OVERSTOCK';
      } else {
        status = 'OPTIMAL';
      }

      return {
        ...item,
        status
      };
    });
  }, [items]);

  // 3. คำนวณสรุปผลสถิติสำหรับ KPI Card ด้านบน
  const summaryStats = useMemo(() => {
    let totalValue = 0;
    let totalUsageValue = 0;
    let underCount = 0;
    let optimalCount = 0;
    let overCount = 0;
    let deadCount = 0;

    itemsWithStatus.forEach(item => {
      totalValue += item.stock_value;
      totalUsageValue += (item.avg_monthly_usage * item.unit_price);
      if (item.status === 'DEAD_STOCK') {
        deadCount++;
      } else if (item.status === 'UNDERSTOCK') {
        underCount++;
      } else if (item.status === 'OVERSTOCK') {
        overCount++;
      } else if (item.status === 'OPTIMAL') {
        optimalCount++;
      }
    });

    const overallMOS = totalUsageValue > 0 ? (totalValue / totalUsageValue) : 0;

    return {
      totalValue,
      totalUsageValue,
      overallMOS,
      underCount,
      optimalCount,
      overCount,
      deadCount
    };
  }, [itemsWithStatus]);

  // 4. การจัดการจัดเรียงข้อมูล
  const handleSort = (key: keyof InventoryAnalysisItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 5. การคัดกรองข้อมูลตามคำค้นหา (Search) และปุ่มสถานะ (Status Tab)
  const filteredItems = useMemo(() => {
    return itemsWithStatus
      .filter(item => {
        // กรองคำค้นหา
        const matchSearch = 
          item.generic_name.toLowerCase().includes(search.toLowerCase()) ||
          item.drug_code.toLowerCase().includes(search.toLowerCase());
        
        // กรองประเภทความเสี่ยงคลัง
        const matchStatus = 
          statusFilter === 'ALL' || 
          item.status === statusFilter;

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else {
          return sortConfig.direction === 'asc' 
            ? (valA as number) - (valB as number) 
            : (valB as number) - (valA as number);
        }
      });
  }, [itemsWithStatus, search, statusFilter, sortConfig]);

  // 6. กำหนดรูปแบบสถานะแต่ละ Badge
  const getStatusBadge = (status: 'UNDERSTOCK' | 'OPTIMAL' | 'OVERSTOCK' | 'DEAD_STOCK') => {
    if (status === 'DEAD_STOCK') return {
      label: 'ไม่มีการเคลื่อนไหว',
      bg: 'bg-neutral-100 text-neutral-700 border-neutral-200'
    };
    if (status === 'UNDERSTOCK') return {
      label: 'สำรองต่ำกว่าเกณฑ์ (< 1 ด.)',
      bg: 'bg-red-50 text-red-700 border-red-200 animate-pulse'
    };
    if (status === 'OVERSTOCK') return {
      label: 'สำรองเกินต้องการ (> 2 ด.)',
      bg: 'bg-amber-50 text-amber-700 border-amber-250'
    };
    return {
      label: 'สำรองปกติ (1-2 ด.)',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  };

  // 7. ส่งออก Excel (.xlsx) แบบมีหลายคอลัมน์วิเคราะห์ครบครัน
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const dataToExport = filteredItems.map(item => {
      const statusInfo = getStatusBadge(item.status);
      return {
        'รหัสเวชภัณฑ์': item.drug_code || '-',
        'ชื่อเวชภัณฑ์': item.generic_name,
        'หน่วยนับ': item.unit_name,
        'จำนวนคงเหลือ': item.ending_stock,
        'ราคาเฉลี่ย/หน่วย': item.unit_price,
        'มูลค่าคงคลังรวม (บาท)': item.stock_value,
        'ยอดจ่ายสะสม': item.total_issued,
        'อัตราใช้เฉลี่ยต่อเดือน': item.avg_monthly_usage,
        'อัตราสำรองคลัง (MOS)': item.months_of_stock === 999.99 ? 'ไม่มีเคลื่อนไหว' : item.months_of_stock,
        'การประเมินสถานะ': statusInfo.label
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory_Analysis');
    
    // ตั้งความกว้างคอลัมน์อัตโนมัติ
    const maxLens = Object.keys(dataToExport[0]).map(key => {
      const len = Math.max(
        key.length * 2,
        ...dataToExport.map(row => String((row as any)[key] || '').length)
      );
      return { wch: len + 3 };
    });
    worksheet['!cols'] = maxLens;

    XLSX.writeFile(workbook, `รายงานวิเคราะห์คลัง_${selectedPeriod}_${selectedMonths}เดือน_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 8. สั่งพิมพ์รายงาน
  const handlePrint = () => {
    window.print();
  };

  const totalCount = itemsWithStatus.length;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mb-8">
      {/* สไตล์การพิมพ์เอกสาร */}
      <style>{`
        @media print {
          aside, header, footer, .no-print, button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            background: white !important;
          }
          .bg-white {
            border: none !important;
            box-shadow: none !important;
          }
          .h-\\[calc\\(100vh-8rem\\)\\] {
            height: auto !important;
            overflow: visible !important;
          }
          .overflow-auto, .overflow-hidden {
            overflow: visible !important;
            height: auto !important;
          }
          body, html {
            height: auto !important;
            overflow: visible !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            padding: 8px !important;
            font-size: 11px !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header และ แผงกรองข้อมูลหลัก */}
      <div className="p-6 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 bg-gray-50/50">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold text-emerald-950 tracking-tight flex items-center gap-2 truncate">
            <Boxes size={24} className="text-emerald-600 flex-shrink-0" />
            <span className="truncate">รายงานอัตราสำรอง & มูลค่าคงคลัง</span>
          </h1>
          <div className="text-sm text-gray-500 font-medium mt-2 flex flex-wrap gap-2 items-center">
            <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-bold shrink-0">
              ข้อมูล ณ สิ้นเดือน: {selectedPeriod}
            </span>
            <span className="hidden sm:inline-block shrink-0">วิเคราะห์ตามการตัดจ่ายจริง</span>
            <span className="text-emerald-800 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 print:bg-transparent print:border-none print:p-0 shrink-0">
              มูลค่ารวม: ฿{summaryStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-emerald-800 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 print:bg-transparent print:border-none print:p-0 shrink-0">
              อัตราสำรองเฉลี่ย (MOS): {summaryStats.overallMOS.toFixed(2)} ด.
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto no-print">
          {/* เลือกเดือนรายงาน */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-gray-200 shadow-sm w-full md:w-auto">
            <Calendar size={16} className="text-emerald-600" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">เดือนที่รายงาน:</span>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent font-bold text-sm text-emerald-800 outline-none cursor-pointer"
            />
          </div>

          {/* เลือกช่วงเวลาคำนวณ */}
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-gray-200 shadow-sm w-full md:w-auto">
            <span className="text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">รอบประเมิน:</span>
            <select
              value={selectedMonths}
              onChange={(e) => setSelectedMonths(Number(e.target.value) as any)}
              className="bg-transparent font-bold text-sm text-emerald-800 outline-none cursor-pointer pr-4"
            >
              <option value={1}>1 เดือนย้อนหลัง</option>
              <option value={3}>3 เดือนย้อนหลัง</option>
              <option value={5}>5 เดือนย้อนหลัง</option>
              <option value={9}>9 เดือนย้อนหลัง</option>
              <option value={12}>12 เดือนย้อนหลัง</option>
            </select>
          </div>

          {/* ค้นหาข้อความ */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือรหัสเวชภัณฑ์..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm text-sm font-medium"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleExportExcel}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-2xl transition-all shadow-sm text-xs font-bold cursor-pointer"
              title="ส่งออกรายงานวิเคราะห์ Excel"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl transition-all shadow-md text-xs font-bold cursor-pointer"
              title="สั่งพิมพ์รายงานวิเคราะห์"
            >
              <Printer size={14} />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>
      </div>

      {/* แผงแสดงสถิติ (KPI Dashboard) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 border-b border-gray-100 no-print bg-gray-50/20">
        {/* KPI: ทั้งหมด (All) */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL' 
              ? 'border-emerald-600 ring-4 ring-emerald-500/10 scale-[1.02] bg-emerald-50/20' 
              : 'border-gray-150 hover:bg-gray-50/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">ทั้งหมด</span>
            <Boxes size={16} className="text-gray-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
            {totalCount}
            <span className="text-xs font-bold text-gray-450 ml-1.5">รายการ</span>
          </p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">เวชภัณฑ์คงสต๊อกทั้งหมด</p>
        </div>

        {/* KPI: สำรองปกติ (Optimal) */}
        <div 
          onClick={() => setStatusFilter('OPTIMAL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'OPTIMAL' 
              ? 'border-emerald-600 ring-4 ring-emerald-500/10 scale-[1.02] bg-emerald-50/20' 
              : 'border-gray-150 hover:bg-gray-50/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-emerald-700/70 uppercase tracking-widest">สำรองปกติ (1-2 ด.)</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {summaryStats.optimalCount}
            <span className="text-xs font-bold text-emerald-500/80 ml-1.5">
              ({totalCount > 0 ? ((summaryStats.optimalCount / totalCount) * 100).toFixed(1) : '0.0'}%)
            </span>
          </p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">เวชภัณฑ์หมุนเวียนคงที่ปกติ</p>
        </div>

        {/* KPI: สำรองต่ำ (Understock) */}
        <div 
          onClick={() => setStatusFilter('UNDERSTOCK')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'UNDERSTOCK' 
              ? 'border-red-500 ring-4 ring-red-500/10 scale-[1.02] bg-red-50/20' 
              : 'border-gray-150 hover:bg-gray-50/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-red-700/80 uppercase tracking-widest">ขาดแคลน (&lt; 1 ด.)</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-red-600 mt-1">
            {summaryStats.underCount}
            <span className="text-xs font-bold text-red-400/90 ml-1.5">
              ({totalCount > 0 ? ((summaryStats.underCount / totalCount) * 100).toFixed(1) : '0.0'}%)
            </span>
          </p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">เวชภัณฑ์ที่เสี่ยงขาดคลัง</p>
        </div>

        {/* KPI: สำรองล้น (Overstock) */}
        <div 
          onClick={() => setStatusFilter('OVERSTOCK')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'OVERSTOCK' 
              ? 'border-amber-500 ring-4 ring-amber-500/10 scale-[1.02] bg-amber-50/20' 
              : 'border-gray-150 hover:bg-gray-50/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-amber-700/80 uppercase tracking-widest">สำรองล้น (&gt; 2 ด.)</span>
            <AlertCircle size={16} className="text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
            {summaryStats.overCount}
            <span className="text-xs font-bold text-amber-550/90 ml-1.5">
              ({totalCount > 0 ? ((summaryStats.overCount / totalCount) * 100).toFixed(1) : '0.0'}%)
            </span>
          </p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">เวชภัณฑ์ที่มีปริมาณสต๊อกสูง</p>
        </div>

        {/* KPI: ไม่เคลื่อนไหว (Dead Stock) */}
        <div 
          onClick={() => setStatusFilter('DEAD_STOCK')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'DEAD_STOCK' 
              ? 'border-neutral-500 ring-4 ring-neutral-500/10 scale-[1.02] bg-neutral-50/20' 
              : 'border-gray-150 hover:bg-gray-50/50'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">ไร้เคลื่อนไหว</span>
            <AlertTriangle size={16} className="text-neutral-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-neutral-700 mt-1">
            {summaryStats.deadCount}
            <span className="text-xs font-bold text-neutral-500/90 ml-1.5">
              ({totalCount > 0 ? ((summaryStats.deadCount / totalCount) * 100).toFixed(1) : '0.0'}%)
            </span>
          </p>
          <p className="text-[10px] text-gray-400 font-semibold mt-1">เวชภัณฑ์ค้างสต๊อกไร้การเบิก</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto md:overflow-visible">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50" onClick={() => handleSort('generic_name')}>
                <div className="flex items-center gap-1.5">
                  รหัส / ชื่อเวชภัณฑ์
                  <ArrowUpDown size={12} className={sortConfig?.key === 'generic_name' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('ending_stock')}>
                <div className="flex items-center justify-end gap-1.5">
                  ยอดคงเหลือคลัง
                  <ArrowUpDown size={12} className={sortConfig?.key === 'ending_stock' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('unit_price')}>
                <div className="flex items-center justify-end gap-1.5">
                  ราคา/หน่วย
                  <ArrowUpDown size={12} className={sortConfig?.key === 'unit_price' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('stock_value')}>
                <div className="flex items-center justify-end gap-1.5">
                  มูลค่าคงคลังรวม
                  <ArrowUpDown size={12} className={sortConfig?.key === 'stock_value' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('total_issued')}>
                <div className="flex items-center justify-end gap-1.5">
                  จ่ายรวม ({selectedMonths} ด.)
                  <ArrowUpDown size={12} className={sortConfig?.key === 'total_issued' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('avg_monthly_usage')}>
                <div className="flex items-center justify-end gap-1.5">
                  อัตราใช้/เดือน
                  <ArrowUpDown size={12} className={sortConfig?.key === 'avg_monthly_usage' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer text-right hover:bg-gray-100/50" onClick={() => handleSort('months_of_stock')}>
                <div className="flex items-center justify-end gap-1.5">
                  อัตราสำรอง (MOS)
                  <ArrowUpDown size={12} className={sortConfig?.key === 'months_of_stock' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 text-center">การประเมินสถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 font-bold">กำลังประมวลผลข้อมูลคงคลังสิ้นเดือน...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-red-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle size={36} className="text-red-400" />
                    <span className="font-bold">ไม่สามารถประมวลผลข้อมูลได้</span>
                    <span className="text-xs text-red-400 font-mono mt-1">{error}</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-gray-400 font-bold">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle size={36} className="text-gray-350" />
                    <span>ไม่พบรายการเวชภัณฑ์ที่ตรงกับเงื่อนไข</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const statusBadge = getStatusBadge(item.status);
                return (
                  <tr key={item.product_id} className="hover:bg-emerald-50/20 transition-colors group">
                    {/* รหัส / ชื่อเวชภัณฑ์ */}
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors">
                        {item.generic_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        {item.drug_code || '-'}
                      </div>
                    </td>
                    
                    {/* จำนวนคงคลัง */}
                    <td className="px-6 py-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      {item.ending_stock.toLocaleString()}{' '}
                      <span className="text-[10px] text-gray-400 font-medium">{item.unit_name}</span>
                    </td>
                    
                    {/* ราคา/หน่วย */}
                    <td className="px-6 py-4 text-right font-medium text-gray-650">
                      ฿{item.unit_price.toFixed(2)}
                    </td>
                    
                    {/* มูลค่าคงคลังรวม */}
                    <td className="px-6 py-4 text-right font-extrabold text-gray-900">
                      ฿{item.stock_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    
                    {/* จ่ายรวม */}
                    <td className="px-6 py-4 text-right font-bold text-gray-600">
                      {item.total_issued.toLocaleString()}{' '}
                      <span className="text-[10px] text-gray-400 font-medium">{item.unit_name}</span>
                    </td>
                    
                    {/* อัตราใช้/เดือน */}
                    <td className="px-6 py-4 text-right font-bold text-gray-650">
                      {item.avg_monthly_usage.toLocaleString()}{' '}
                      <span className="text-[10px] text-gray-400 font-medium">/{item.unit_name}</span>
                    </td>
                    
                    {/* อัตราสำรองคลัง (MOS) */}
                    <td className="px-6 py-4 text-right font-black">
                      {item.months_of_stock === 999.99 ? (
                        <span className="text-neutral-450 text-xs font-bold">ไม่มีการเบิก</span>
                      ) : (
                        <span className={item.months_of_stock < 1.0 ? 'text-red-600' : item.months_of_stock > 2.0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {item.months_of_stock.toFixed(2)} <span className="text-[10px] font-bold">ด.</span>
                        </span>
                      )}
                    </td>
                    
                    {/* การประเมินสถานะ */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1.5 rounded-xl border text-xs font-black shadow-sm tracking-wide ${statusBadge.bg}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
