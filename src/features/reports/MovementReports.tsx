import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Printer, Search, CalendarDays, Ban, ExternalLink, Calendar } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export default function MovementReports() {
  const [searchParams] = useSearchParams();
  const [reportType, setReportType] = useState(searchParams.get('type') || 'RECEIVE'); // RECEIVE, ISSUE, ADJUST
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); 
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('ALL');

  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. ดึงข้อมูลปีงบประมาณทั้งหมดเมื่อ mount
  useEffect(() => {
    const fetchFiscalYears = async () => {
      try {
        const { data, error } = await supabase
          .from('master_fiscal_years')
          .select('id, year_name, start_date, end_date, is_active')
          .order('year_name', { ascending: false });
        if (error) throw error;
        if (data) {
          setFiscalYears(data);
          const activeYear = data.find(fy => fy.is_active);
          if (activeYear) {
            setSelectedFiscalYear(activeYear.id);
            setStartDate(activeYear.start_date);
            setEndDate(activeYear.end_date);
          }
        }
      } catch (err) {
        console.error('Error fetching fiscal years in movements:', err);
      }
    };
    fetchFiscalYears();
  }, []);

  // 2. ดึงข้อมูลรายงานการเคลื่อนไหวสต๊อก
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('stock_movements')
        .select(`
          id, doc_no, doc_date, movement_type, created_at, is_voided, voided_at, fiscal_year_id,
          stock_movement_items(product_id, qty, unit_price, products(generic_name))
        `)
        .eq('movement_type', reportType)
        .gte('doc_date', new Date(startDate).toISOString().split('T')[0])
        .lte('doc_date', new Date(endDate).toISOString().split('T')[0])
        .order('doc_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedFiscalYear !== 'ALL') {
        query = query.eq('fiscal_year_id', selectedFiscalYear);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setMovements(data || []);
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiscalYearChange = (yearId: string) => {
    setSelectedFiscalYear(yearId);
    if (yearId === 'ALL') return;
    const selectedYear = fiscalYears.find(fy => fy.id === yearId);
    if (selectedYear) {
      setStartDate(selectedYear.start_date);
      setEndDate(selectedYear.end_date);
    }
  };

  const handleVoid = async (movementId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการ Void (ยกเลิก) รายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะคืนยอดสต๊อกกลับไป (หากทำได้)')) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

      const { error } = await supabase.rpc('void_stock_movement', {
        p_movement_id: movementId,
        p_user_id: user.id
      });

      if (error) throw error;
      
      alert('Void รายการสำเร็จ!');
      fetchReports(); // Refresh data
    } catch (err: any) {
      console.error(err);
      alert('ไม่สามารถ Void ได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getReportTitle = () => {
    if (reportType === 'RECEIVE') return 'รายงานการรับเวชภัณฑ์เข้าคลัง';
    if (reportType === 'ISSUE') return 'รายงานการตัดจ่ายเวชภัณฑ์';
    if (reportType === 'ADJUST') return 'รายงานการปรับยอด/ตรวจนับ';
    return 'รายงานสรุปการเคลื่อนไหวคลัง';
  };

  const grandTotalQty = movements
    .filter(m => !m.is_voided)
    .reduce((sum, m) => sum + m.stock_movement_items.reduce((s: number, item: any) => s + Math.abs(item.qty), 0), 0);

  const grandTotalValue = movements
    .filter(m => !m.is_voided)
    .reduce((sum, m) => sum + m.stock_movement_items.reduce((s: number, item: any) => s + Math.abs(item.qty) * (item.unit_price || 0), 0), 0);

  const formatBaht = (value: number) =>
    value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in-up font-sans select-none">
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-950 tracking-tight">รายงานการรับ-จ่าย (Movement)</h1>
            <p className="text-blue-700 font-medium">ดูสรุปรายงานการรับเข้า จ่ายออก หรือปรับยอดและกรองข้อมูลตามปีงบประมาณ</p>
          </div>
        </div>
      </div>

      {/* แถบฟิลเตอร์การค้นหา */}
      <div className="glass p-6 rounded-3xl space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* ประเภทรายงาน */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ประเภทรายงาน</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2.5 bg-white border border-blue-100 rounded-xl font-bold focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 cursor-pointer transition-all shadow-sm"
            >
              <option value="RECEIVE">รายงานการรับเวชภัณฑ์เข้า (Receives)</option>
              <option value="ISSUE">รายงานการตัดจ่ายเวชภัณฑ์ (Issues)</option>
              <option value="ADJUST">รายงานการตรวจนับ/ปรับยอด (Adjustments)</option>
              <option value="DISPOSE">รายงานการทำลาย/ยาหมดอายุ (Disposals)</option>
              <option value="BORROW">รายงานการให้ยืมเวชภัณฑ์ (Borrowings)</option>
              <option value="RETURN">รายงานการรับคืนเวชภัณฑ์ (Returns)</option>
            </select>
          </div>

          {/* เลือกปีงบประมาณ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ปีงบประมาณ</label>
            <div className="relative">
              <select
                value={selectedFiscalYear}
                onChange={e => handleFiscalYearChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-blue-100 rounded-xl font-bold focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 appearance-none pr-8 cursor-pointer transition-all shadow-sm"
              >
                <option value="ALL">ปีงบประมาณทั้งหมด (All)</option>
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.id}>
                    ปีงบประมาณ {fy.year_name} {fy.is_active ? '(ปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none w-4 h-4" />
            </div>
          </div>

          {/* ตั้งแต่วันที่ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ตั้งแต่วันที่</label>
            <DatePicker 
              value={startDate} 
              onChange={date => {
                setStartDate(date);
                setSelectedFiscalYear('ALL');
              }} 
              className="w-full p-2.5 border border-blue-100 rounded-xl font-medium focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 transition-all shadow-sm"
            />
          </div>

          {/* ถึงวันที่ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ถึงวันที่</label>
            <DatePicker 
              value={endDate} 
              onChange={date => {
                setEndDate(date);
                setSelectedFiscalYear('ALL');
              }} 
              className="w-full p-2.5 border border-blue-100 rounded-xl font-medium focus:ring-2 focus:ring-blue-100 outline-none text-blue-900 transition-all shadow-sm"
            />
          </div>

        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={fetchReports}
            disabled={isLoading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Search size={18} /> {isLoading ? 'กำลังโหลด...' : 'เรียกดูข้อมูล'}
          </button>
          <button 
            onClick={handlePrint}
            disabled={movements.length === 0}
            className="px-6 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 text-gray-700 disabled:opacity-50"
          >
            <Printer size={18} /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      {movements.length > 0 && (
        <div className="bg-white p-8 rounded-none md:rounded-3xl shadow-none md:shadow-xl print:shadow-none print:p-0">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black mb-1 text-blue-950">{getReportTitle()}</h2>
            <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-2 font-bold">
              <CalendarDays size={14} className="text-blue-600" />
              ช่วงวันที่ {formatDate(startDate)} ถึง {formatDate(endDate)}
              {selectedFiscalYear !== 'ALL' && ` (ปีงบประมาณ ${fiscalYears.find(fy => fy.id === selectedFiscalYear)?.year_name})`}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-lg text-blue-800 font-extrabold text-sm print:border print:border-blue-200">
                ยอดรวมปริมาณ: {grandTotalQty.toLocaleString()}
              </div>
              <div className="inline-flex items-center gap-2 bg-emerald-50 px-4 py-1.5 rounded-lg text-emerald-800 font-extrabold text-sm print:border print:border-emerald-200">
                มูลค่ารวมทั้งหมด: {formatBaht(grandTotalValue)} บาท
              </div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead>
              <tr className="bg-blue-50 print:bg-blue-50 text-blue-950">
                <th className="border border-gray-300 p-2.5 w-32 text-center font-bold">วันที่ทำรายการ</th>
                <th className="border border-gray-300 p-2.5 w-40 text-center font-bold">เลขที่เอกสาร</th>
                <th className="border border-gray-300 p-2.5 text-left font-bold">รายละเอียดรายการเวชภัณฑ์</th>
                <th className="border border-gray-300 p-2.5 w-24 text-right font-bold">จำนวนรวม</th>
                <th className="border border-gray-300 p-2.5 w-32 text-right font-bold">มูลค่ารวม (บาท)</th>
                <th className="border border-gray-300 p-2.5 w-24 text-center font-bold print:hidden">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const totalQty = m.stock_movement_items.reduce((sum: number, item: any) => sum + Math.abs(item.qty), 0);
                const totalValue = m.stock_movement_items.reduce((sum: number, item: any) => sum + Math.abs(item.qty) * (item.unit_price || 0), 0);
                
                return (
                  <tr key={m.id} className="hover:bg-gray-50 print:hover:bg-white align-top transition-colors">
                    <td className="border border-gray-300 p-2.5 text-center text-xs whitespace-nowrap">
                      <div className="font-bold text-gray-800">{m.doc_date ? formatDate(m.doc_date) : '-'}</div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(m.created_at).toLocaleString('th-TH', { 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-2.5 text-center text-xs font-mono font-bold text-gray-600">
                      <Link 
                        to={`/movement/print/${m.id}`} 
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center justify-center gap-1"
                        title="พิมพ์เอกสาร / ดูรายละเอียด"
                      >
                        {m.doc_no || `REF-${m.id.substring(0, 8).toUpperCase()}`}
                        <ExternalLink size={12} className="print:hidden" />
                      </Link>
                    </td>
                    <td className="border border-gray-300 p-2 text-xs">
                      {m.is_voided && (
                        <div className="mb-2 inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                          <Ban size={12} /> ถูกยกเลิก (VOIDED)
                        </div>
                      )}
                      <ul className={`list-disc list-inside space-y-1 text-gray-700 ${m.is_voided ? 'opacity-50 line-through' : ''}`}>
                        {m.stock_movement_items.map((item: any, i: number) => (
                          <li key={i}>
                            {item.products?.generic_name || 'ไม่ระบุชื่อเวชภัณฑ์'} 
                            <span className="font-bold ml-1">({item.qty > 0 ? '+' : ''}{item.qty.toLocaleString()})</span>
                            {item.unit_price > 0 && (
                              <span className="text-gray-400 ml-1">@ {formatBaht(item.unit_price)} บ.</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={`border border-gray-300 p-2.5 text-right font-extrabold ${m.is_voided ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                      {totalQty.toLocaleString()}
                    </td>
                    <td className={`border border-gray-300 p-2.5 text-right font-extrabold ${m.is_voided ? 'text-gray-400 line-through' : 'text-emerald-700'}`}>
                      {formatBaht(totalValue)}
                    </td>
                    <td className="border border-gray-300 p-2.5 text-center print:hidden">
                      {!m.is_voided && (
                        <button
                          onClick={() => handleVoid(m.id)}
                          className="text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded font-bold transition-colors"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50/10 font-bold print:bg-blue-50/10">
                <td colSpan={3} className="border border-gray-300 p-2.5 text-right text-sm">ยอดรวมปริมาณเวชภัณฑ์ทั้งหมด:</td>
                <td className="border border-gray-300 p-2.5 text-right text-sm text-blue-700">
                  {grandTotalQty.toLocaleString()}
                </td>
                <td className="border border-gray-300 p-2.5 text-right text-sm text-emerald-700">
                  {formatBaht(grandTotalValue)} บาท
                </td>
                <td className="border border-gray-300 p-2.5 text-center print:hidden"></td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-8 text-right text-sm print:block hidden">
            <p>ลงชื่อผู้จัดทำรายงาน: _____________________</p>
            <p className="text-xs text-gray-400 mt-1">วันที่พิมพ์: {new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
