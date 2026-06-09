import { formatDate } from '@/utils/dateUtils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, AlertCircle, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { StockBalance } from '@/types';

export default function StockBalancePage() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'dosage_form' | 'expiry_date', direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: 'name' | 'dosage_form' | 'expiry_date') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const fetchStock = async () => {
      const { data, error } = await supabase
        .from('stock_balances')
        .select(`
          id, current_qty, lot_id,
          lots ( lot_number, expiry_date, unit_price ),
          products ( 
            generic_name, trade_name, drug_code, unit_price, pack_size, is_cold_storage, is_psycho_narco, is_high_alert,
            master_dosage_forms(name_en, name_th, abbreviation),
            master_units(name:unit_name)
          )
        `)
        .gt('current_qty', 0);
        
      if (data) {
        const mappedData = data.map((b: any) => ({
          ...b,
          lot_number: b.lots?.lot_number || '',
          expiry_date: b.lots?.expiry_date || '',
          unit_price: b.lots?.unit_price || b.products?.unit_price || 0
        }));
        setBalances(mappedData);
      }
      setIsLoading(false);
    };
    fetchStock();
  }, []);

  const filteredBalances = balances.filter(b => {
    const p = b.products as any;
    const df = p?.master_dosage_forms;
    return (
      p?.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      p?.trade_name?.toLowerCase().includes(search.toLowerCase()) ||
      p?.drug_code?.toLowerCase().includes(search.toLowerCase()) ||
      b.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
      df?.name_en?.toLowerCase().includes(search.toLowerCase()) ||
      df?.name_th?.toLowerCase().includes(search.toLowerCase()) ||
      df?.abbreviation?.toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const pA = a.products as any;
    const pB = b.products as any;
    
    let valA = '';
    let valB = '';
    
    if (sortConfig.key === 'name') {
      valA = pA?.generic_name || '';
      valB = pB?.generic_name || '';
    } else if (sortConfig.key === 'dosage_form') {
      const dfA = pA?.master_dosage_forms;
      const dfB = pB?.master_dosage_forms;
      valA = dfA?.abbreviation || dfA?.name_en || dfA?.name_th || '';
      valB = dfB?.abbreviation || dfB?.name_en || dfB?.name_th || '';
    } else if (sortConfig.key === 'expiry_date') {
      valA = a.expiry_date || '';
      valB = b.expiry_date || '';
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // ฟังก์ชันคำนวณวันหมดอายุเพื่อไฮไลต์สี
  const getExpiryColor = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 'text-red-600';
    if (days <= 90) return 'text-yellow-600';
    return 'text-gray-700';
  };

  // ฟังก์ชันส่งออกไฟล์ CSV สำหรับเปิดภาษาไทยใน MS Excel 100%
  const handleExportCSV = () => {
    if (filteredBalances.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    
    // สร้างหัวตาราง CSV
    const headers = ['Product Code', 'Product Name (Generic Name)', 'Trade Name', 'Dosage Form', 'Lot Number', 'Exp', 'จำนวนคงเหลือ', 'ราคาต่อหน่วย', 'มูลค่ารวม'];
    
    // แปลงข้อมูลแถว
    const rows = filteredBalances.map(b => {
      const p = b.products as any;
      const df = p?.master_dosage_forms;
      const dosageStr = df ? `${df.abbreviation ? df.abbreviation + ' ' : ''}(${df.name_en || df.name_th || ''})` : '';
      
      return [
        p?.drug_code || '',
        p?.generic_name || '',
        p?.trade_name || '',
        dosageStr.trim(),
        b.lot_number || '',
        b.expiry_date ? formatDate(b.expiry_date) : '',
        b.current_qty.toString(),
        (b.unit_price || p?.unit_price || 0).toString(),
        (b.current_qty * (b.unit_price || p?.unit_price || 0)).toString()
      ];
    });
    
    // รวมข้อมูล CSV และทำการ Escape เครื่องหมายฟันหนู
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // การบันทึกภาษาไทยให้ถูกต้องใน Excel ต้องใช้ UTF-8 BOM
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = formatDate(new Date().toISOString()).replace(/\//g, '-');
    link.setAttribute('download', `รายงานสต๊อกคงเหลือ_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // เรียกฟังก์ชันพิมพ์จากเบราว์เซอร์
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* สไตล์ชีตครอบคลุมการจัดรูปแบบเวลาสั่งพิมพ์รายงาน PDF */}
      <style>{`
        @media print {
          /* ซ่อน Sidebar layout, Header ของระบบ และปุ่มกดเวลาพิมพ์ */
          aside, header, .no-print, button {
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
            padding: 10px !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header & Search */}
      <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/50">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">สต๊อกคงเหลือ</h1>
          <p className="text-sm text-gray-500 font-medium">ยอดคงเหลือเรียงตามวันหมดอายุ (FEFO) เพื่อการจัดการที่มีประสิทธิภาพ</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto no-print">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อเวชภัณฑ์, Trade Name, Lot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm text-sm"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all shadow-sm text-sm font-bold cursor-pointer"
              title="ส่งออกไฟล์รายงาน Excel (.csv)"
            >
              <Download size={16} />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md text-sm font-bold cursor-pointer"
              title="พิมพ์รายงานสต๊อกเวชภัณฑ์ประจำเดือน (PDF)"
            >
              <Printer size={16} />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th 
                className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  รหัส / ชื่อเวชภัณฑ์
                  <ArrowUpDown size={14} className={sortConfig?.key === 'name' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('dosage_form')}
              >
                <div className="flex items-center gap-1">
                  รูปแบบยา
                  <ArrowUpDown size={14} className={sortConfig?.key === 'dosage_form' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">Lot Number</th>
              <th 
                className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('expiry_date')}
              >
                <div className="flex items-center gap-1">
                  วันหมดอายุ
                  <ArrowUpDown size={14} className={sortConfig?.key === 'expiry_date' ? 'text-emerald-500' : 'text-gray-300'} />
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right border-b border-gray-100">ยอดคงเหลือ</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right border-b border-gray-100">ราคา/หน่วย</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right border-b border-gray-100">มูลค่ารวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="p-10 text-center text-blue-600 font-bold animate-pulse">กำลังโหลดข้อมูลสต๊อก...</td></tr>
            ) : filteredBalances.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle size={32} className="text-gray-300" />
                    <p className="font-bold">ไม่พบรายการเวชภัณฑ์ดังกล่าว</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBalances.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {item.products?.generic_name} 
                      {item.products?.trade_name && <span className="text-gray-500 font-medium text-xs ml-1.5">({item.products?.trade_name})</span>}
                    </div>
                    <div className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{item.products?.drug_code || '-'}</span>
                      {(item.products as any)?.is_cold_storage && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">COLD</span>}
                      {(item.products as any)?.is_psycho_narco && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Psycho</span>}
                      {(item.products as any)?.is_high_alert && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold animate-pulse">HAD</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {(() => {
                      const df = (item.products as any)?.master_dosage_forms;
                      if (!df) return '-';
                      return (
                        <div>
                          <span>{df.name_en || df.name_th || '-'}</span>
                          {df.abbreviation && <span className="text-gray-400 ml-1">({df.abbreviation})</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700">
                      {item.lot_number || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${getExpiryColor(item.expiry_date || '')}`}>
                      {item.expiry_date ? formatDate(item.expiry_date) : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      {item.current_qty} x {((item.products as any)?.pack_size || 1).toLocaleString('th-TH')} {(item.products as any)?.master_units?.name || 'ชิ้น'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-gray-600">
                      ฿{(item.unit_price || item.products?.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-extrabold text-emerald-700">
                      ฿{(item.current_qty * (item.unit_price || item.products?.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
