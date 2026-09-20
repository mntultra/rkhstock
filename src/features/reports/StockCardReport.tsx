import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileSpreadsheet, Printer, Search, Calendar } from 'lucide-react';
import { ProductSearchResult } from '@/types';

// ฟังก์ชันแปลงวันที่เป็น พ.ศ. (DD/MM/YYYY)
const formatThaiDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
};

// ฟังก์ชันแปลงวัน-เวลาพิมพ์เอกสารเป็น พ.ศ. (เมื่อวันที่ dd/m/yyyy เวลา hh:mm:ss)
const getPrintDateTimeText = (date: Date = new Date()): string => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear() + 543;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `เมื่อวันที่ ${d}/${m}/${y} เวลา ${hh}:${mm}:${ss}`;
};

export default function StockCardReport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [printTimestamp, setPrintTimestamp] = useState<string>(() => getPrintDateTimeText());
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('');
  const [balanceBroughtForward, setBalanceBroughtForward] = useState<number>(0);

  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. ดึงปีงบประมาณทั้งหมดเมื่อ mount
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
        console.error('Error fetching fiscal years:', err);
      }
    };
    fetchFiscalYears();
  }, []);

  // 2. ค้นหายา (Fuzzy Search)
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('id, generic_name, abbreviation, drug_code')
        .or(`generic_name.ilike.%${searchQuery}%,abbreviation.ilike.%${searchQuery}%,drug_code.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(20);
      setSearchResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSearchQuery(`${product.drug_code || ''} - ${product.generic_name}`);
    setSearchResults([]);
  };

  // 3. จัดการเมื่อเปลี่ยนปีงบประมาณ
  const handleFiscalYearChange = (yearId: string) => {
    setSelectedFiscalYear(yearId);
    const selectedYear = fiscalYears.find(fy => fy.id === yearId);
    if (selectedYear) {
      setStartDate(selectedYear.start_date);
      setEndDate(selectedYear.end_date);
    }
  };

  // 4. ดึงข้อมูลบัญชีคุมเวชภัณฑ์ (Stock Card) พร้อมยอดยกมา
  const fetchStockCard = async () => {
    if (!selectedProduct) return;
    setIsLoading(true);
    try {
      // 4.1 คำนวณยอดยกมา (Balance Brought Forward) ก่อน startDate
      const { data: bbData, error: bbError } = await supabase
        .from('stock_movement_items')
        .select(`
          qty,
          stock_movements!inner(is_voided, doc_date, movement_type)
        `)
        .eq('product_id', selectedProduct.id)
        .lt('stock_movements.doc_date', startDate)
        .eq('stock_movements.is_voided', false);

      if (bbError) throw bbError;
      
      const bbSum = bbData ? bbData.reduce((sum: number, item: any) => {
        const type = item.stock_movements.movement_type;
        let delta = 0;
        if (['RECEIVE', 'RETURN'].includes(type)) delta = Math.abs(item.qty || 0);
        else if (['ISSUE', 'DISPOSE', 'EXPIRED', 'BORROW'].includes(type)) delta = -Math.abs(item.qty || 0);
        else if (type === 'ADJUST') delta = item.qty || 0;
        return sum + delta;
      }, 0) : 0;
      setBalanceBroughtForward(bbSum);

      // 4.2 ดึงรายการความเคลื่อนไหวภายในช่วงเวลาที่เลือก
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('stock_movement_items')
        .select(`
          qty,
          lots (lot_number),
          stock_movements!inner(id, doc_no, reference_doc_no, reference_doc_date, movement_type, doc_date, created_by, is_voided, note)
        `)
        .eq('product_id', selectedProduct.id)
        .eq('stock_movements.is_voided', false)
        .gte('stock_movements.doc_date', startDate)
        .lte('stock_movements.doc_date', endDate);

      if (error) throw error;
      
      // เรียงลำดับตามวันที่ทำรายการ (JavaScript Sort)
      const sortedData = (data || []).sort((a: any, b: any) => {
        const timeDiff = new Date(a.stock_movements.doc_date).getTime() - new Date(b.stock_movements.doc_date).getTime();
        if (timeDiff !== 0) return timeDiff;
        
        // ถ้าเป็นวันเดียวกัน ให้รายการนำเข้า (RECEIVE, RETURN, ADJUST) อยู่ก่อนรายการตัดออก
        const isAIn = ['RECEIVE', 'RETURN', 'ADJUST'].includes(a.stock_movements.movement_type);
        const isBIn = ['RECEIVE', 'RETURN', 'ADJUST'].includes(b.stock_movements.movement_type);
        if (isAIn && !isBIn) return -1;
        if (!isAIn && isBIn) return 1;
        return 0;
      });
      
      // 4.3 คำนวณยอดคงเหลือสะสมทีละบรรทัด (Running Balance)
      let currentBalance = bbSum;
      const processedMovements = sortedData.map((m: any) => {
        const type = m.stock_movements.movement_type;
        let delta = 0;
        if (['RECEIVE', 'RETURN'].includes(type)) delta = Math.abs(m.qty || 0);
        else if (['ISSUE', 'DISPOSE', 'EXPIRED', 'BORROW'].includes(type)) delta = -Math.abs(m.qty || 0);
        else if (type === 'ADJUST') delta = m.qty || 0;
        
        currentBalance += delta;
        return {
          ...m,
          lot_number: m.lots?.lot_number || '-',
          running_balance: currentBalance
        };
      });

      setMovements(processedMovements);
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintTimestamp(getPrintDateTimeText(new Date()));
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in-up font-sans select-none">
      {/* สไตล์การพิมพ์เอกสาร Stock Card */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 14mm 10mm !important;
            @bottom-left {
              content: "เอกสารนี้พิมพ์จากระบบ RKHSTOCK ${printTimestamp}";
              font-size: 8pt;
              font-family: inherit;
              color: #4b5563;
            }
            @bottom-right {
              content: "หน้าที่ " counter(page) " จาก " counter(pages);
              font-size: 8pt;
              font-family: inherit;
              color: #4b5563;
            }
          }

          /* ซ่อนส่วนที่ไม่ต้องการพิมพ์ */
          aside, header, nav, .no-print, button {
            display: none !important;
          }

          /* thead ให้วนซ้ำหัวตารางในทุกหน้า */
          thead {
            display: table-header-group !important;
          }

          /* tfoot ให้แสดงเฉพาะหน้าสุดท้าย ไม่วนซ้ำทุกหน้า */
          tfoot {
            display: table-row-group !important;
          }

          /* ป้องกัน tr แตกแถวข้ามหน้าแบบครึ่งๆ กลางๆ */
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Non-printable header */}
      <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">บัญชีคุมเวชภัณฑ์ (Stock Card)</h1>
            <p className="text-emerald-700 font-medium">ดูประวัติการรับเข้า-จ่ายออก และยอดคงคลังยกยอดตามปีงบประมาณราชการ</p>
          </div>
        </div>
      </div>

      {/* Filter Options (Hidden on Print) */}
      <div className="glass p-6 rounded-3xl space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          {/* เลือกเวชภัณฑ์ */}
          <div className="md:col-span-2 relative">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">เลือกรายการเวชภัณฑ์</label>
            <input
              type="text"
              placeholder="ค้นหาชื่อเวชภัณฑ์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2.5 border border-emerald-100 rounded-xl font-medium focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm"
            />
            {searchResults.length > 0 && !selectedProduct && (
              <ul className="absolute z-10 w-full bg-white border border-gray-100 mt-1 shadow-lg max-h-60 overflow-auto rounded-xl">
                {searchResults.map(p => (
                  <li 
                    key={p.id} 
                    onClick={() => handleSelectProduct(p)}
                    className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 font-medium flex flex-col"
                  >
                    <span className="text-gray-900">{p.drug_code || ''} - {p.generic_name}</span>
                    {p.abbreviation && <span className="text-xs text-gray-500">({p.abbreviation})</span>}
                  </li>
                ))}
              </ul>
            )}
            {selectedProduct && (
              <div className="absolute top-8 right-2 bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs flex items-center gap-1 font-bold">
                ✓ เลือกแล้ว
                <button onClick={() => { setSelectedProduct(null); setSearchQuery(''); }} className="hover:text-red-500 ml-1">✕</button>
              </div>
            )}
          </div>

          {/* เลือกปีงบประมาณ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">เลือกปีงบประมาณ</label>
            <div className="relative">
              <select
                value={selectedFiscalYear}
                onChange={e => handleFiscalYearChange(e.target.value)}
                className="w-full p-2.5 border border-emerald-100 rounded-xl font-bold bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm cursor-pointer appearance-none pr-8 text-emerald-800"
              >
                <option value="">-- กำหนดช่วงวันเอง --</option>
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.id}>
                    ปีงบประมาณ {fy.year_name} {fy.is_active ? '(ปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none w-4 h-4" />
            </div>
          </div>

          {/* ตั้งแต่วันที่ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ตั้งแต่วันที่</label>
            <DatePicker 
              value={startDate} 
              onChange={date => {
                setStartDate(date);
                setSelectedFiscalYear(''); // เคลียร์ปีงบประมาณเพื่อเข้าโหมดระบุเอง
              }} 
              className="w-full p-2.5 border border-emerald-100 rounded-xl font-medium focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm text-emerald-800"
            />
          </div>

          {/* ถึงวันที่ */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">ถึงวันที่</label>
            <DatePicker 
              value={endDate} 
              onChange={date => {
                setEndDate(date);
                setSelectedFiscalYear(''); // เคลียร์ปีงบประมาณเพื่อเข้าโหมดระบุเอง
              }} 
              className="w-full p-2.5 border border-emerald-100 rounded-xl font-medium focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm text-emerald-800"
            />
          </div>

        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={fetchStockCard}
            disabled={!selectedProduct || isLoading}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Search size={18} /> {isLoading ? 'กำลังโหลด...' : 'ดูบัญชีคุม'}
          </button>
          <button 
            onClick={handlePrint}
            disabled={movements.length === 0}
            className="px-6 py-2.5 bg-white border border-emerald-100 hover:bg-emerald-50 font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 text-emerald-700"
          >
            <Printer size={18} /> พิมพ์ Stock Card
          </button>
        </div>
      </div>

      {/* Printable Area */}
      {(movements.length > 0 || balanceBroughtForward > 0) && (
        <div className="bg-white p-4 sm:p-6 rounded-none md:rounded-2xl shadow-none md:shadow-lg print:shadow-none print:p-0">
          <div className="text-center mb-4">
            <h2 className="text-xl font-black mb-1 text-emerald-950">บัญชีคุมเวชภัณฑ์ (Stock Card)</h2>
            <p className="text-sm font-bold text-gray-700">
              ชื่อเวชภัณฑ์: <span className="text-emerald-800">{selectedProduct?.generic_name}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5 font-bold">
              ช่วงวันที่ {formatThaiDate(startDate)} ถึง {formatThaiDate(endDate)} 
              {selectedFiscalYear && ` (ปีงบประมาณ ${fiscalYears.find(fy => fy.id === selectedFiscalYear)?.year_name})`}
            </p>
          </div>

          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-emerald-50 print:bg-emerald-50 text-emerald-950 text-xs">
                <th className="border border-gray-300 py-1.5 px-2 w-24 text-center font-bold">วันที่</th>
                <th className="border border-gray-300 py-1.5 px-2 w-32 text-center font-bold">ประเภทรายการ</th>
                <th className="border border-gray-300 py-1.5 px-2 w-28 text-center font-bold">Lot Number</th>
                <th className="border border-gray-300 py-1.5 px-2 text-center text-green-800 w-20 font-bold">รับ (In)</th>
                <th className="border border-gray-300 py-1.5 px-2 text-center text-red-800 w-20 font-bold">จ่าย (Out)</th>
                <th className="border border-gray-300 py-1.5 px-2 text-center text-indigo-900 w-24 font-bold">คงเหลือสะสม</th>
                <th className="border border-gray-300 py-1.5 px-2 text-center w-52 font-bold">เลขที่เอกสาร / เอกสารอ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {/* แถวยอดยกมา (Balance Brought Forward) */}
              <tr className="bg-emerald-50/20 font-bold border-b border-gray-300 text-xs">
                <td className="border border-gray-300 py-1 px-2 text-center text-[11px] text-gray-400">
                  -
                </td>
                <td className="border border-gray-300 py-1 px-2 text-center text-[11px] text-emerald-800">
                  ยอดยกมา (Brought Forward)
                </td>
                <td className="border border-gray-300 py-1 px-2 text-center font-mono text-[11px] text-gray-400">
                  -
                </td>
                <td className="border border-gray-300 py-1 px-2 text-right text-gray-400">
                  -
                </td>
                <td className="border border-gray-300 py-1 px-2 text-right text-gray-400">
                  -
                </td>
                <td className="border border-gray-300 py-1 px-2 text-right font-black text-emerald-800 bg-emerald-50/10">
                  {balanceBroughtForward.toLocaleString()}
                </td>
                <td className="border border-gray-300 py-1 px-2 text-center text-[10px] text-emerald-700/80 font-bold">
                  ยอดยกมาจากปีงบประมาณเดิม/ก่อนหน้าช่วงเวลา
                </td>
              </tr>

              {/* รายการเคลื่อนไหวระหว่างงวด */}
              {movements.map((m, idx) => {
                const isReceive = m.stock_movements.movement_type === 'RECEIVE';
                const isIssue = m.stock_movements.movement_type === 'ISSUE';
                const isAdjust = m.stock_movements.movement_type === 'ADJUST';
                const isDispose = m.stock_movements.movement_type === 'DISPOSE' || m.stock_movements.movement_type === 'EXPIRED';
                
                let qtyIn = 0;
                let qtyOut = 0;
                
                if (isReceive) qtyIn = Math.abs(m.qty);
                if (isIssue || isDispose) qtyOut = Math.abs(m.qty);
                if (isAdjust) {
                  if (m.qty > 0) qtyIn = m.qty;
                  else qtyOut = Math.abs(m.qty);
                }

                let typeLabel = m.stock_movements.movement_type;
                if (isReceive) typeLabel = 'รับเวชภัณฑ์เข้า';
                if (isIssue) typeLabel = 'ตัดจ่ายเวชภัณฑ์';
                if (isAdjust) typeLabel = 'ปรับยอด/ตรวจนับ';
                if (isDispose) typeLabel = 'ทำลาย/ตัดจ่ายชำรุด';

                return (
                  <tr key={idx} className="hover:bg-gray-50 print:hover:bg-white transition-colors text-xs">
                    <td className="border border-gray-300 py-1 px-2 text-center text-[11px]">
                      {formatThaiDate(m.stock_movements.doc_date)}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-center font-medium text-[11px]">
                      {typeLabel}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-center font-mono text-[11px] text-gray-700">
                      {m.lot_number || '-'}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-right font-bold text-green-700">
                      {qtyIn > 0 ? qtyIn.toLocaleString() : '-'}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-right font-bold text-red-700">
                      {qtyOut > 0 ? qtyOut.toLocaleString() : '-'}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-right font-black text-emerald-950 bg-emerald-50/5">
                      {m.running_balance.toLocaleString()}
                    </td>
                    <td className="border border-gray-300 py-1 px-2 text-left text-xs leading-snug">
                      {/* เลขที่เอกสารระบบ */}
                      {m.stock_movements.doc_no && (
                        <div className="font-mono text-gray-800">
                          {m.stock_movements.doc_no}
                        </div>
                      )}

                      {/* ข้อมูลเอกสารอ้างอิง (ใบจ่าย / ใบนำส่ง) */}
                      {m.stock_movements.reference_doc_no ? (
                        <div className="text-[11px] text-emerald-900">
                          <span className="text-gray-500">{isReceive ? 'ใบจ่าย/นำส่ง: ' : 'อ้างอิง: '}</span>
                          <span className="font-mono text-emerald-800">{m.stock_movements.reference_doc_no}</span>
                          {m.stock_movements.reference_doc_date && (
                            <span className="text-[10px] text-gray-500 ml-1">
                              ({formatThaiDate(m.stock_movements.reference_doc_date)})
                            </span>
                          )}
                        </div>
                      ) : m.stock_movements.reference_doc_date ? (
                        <div className="text-[10px] text-gray-500">
                          ลงวันที่: {formatThaiDate(m.stock_movements.reference_doc_date)}
                        </div>
                      ) : !m.stock_movements.doc_no ? (
                        <div className="text-[10px] text-gray-400 font-mono">
                          {`REF-${m.stock_movements.id.substring(0, 8).toUpperCase()}`}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50/20 font-bold print:bg-emerald-50/10 text-xs">
                <td colSpan={3} className="border border-gray-300 py-1.5 px-2 text-right text-emerald-950">รวมรับ/จ่ายสะสมงวดนี้:</td>
                <td className="border border-gray-300 py-1.5 px-2 text-right text-green-700 font-extrabold">
                  {movements.reduce((sum, m) => sum + (m.stock_movements.movement_type === 'RECEIVE' || (m.stock_movements.movement_type === 'ADJUST' && m.qty > 0) ? Math.abs(m.qty) : 0), 0).toLocaleString()}
                </td>
                <td className="border border-gray-300 py-1.5 px-2 text-right text-red-700 font-extrabold">
                  {movements.reduce((sum, m) => sum + (m.stock_movements.movement_type === 'ISSUE' || m.stock_movements.movement_type === 'DISPOSE' || m.stock_movements.movement_type === 'EXPIRED' || (m.stock_movements.movement_type === 'ADJUST' && m.qty < 0) ? Math.abs(m.qty) : 0), 0).toLocaleString()}
                </td>
                <td className="border border-gray-300 py-1.5 px-2 text-right text-emerald-900 bg-emerald-100/30 font-black">
                  {(movements.length > 0 ? movements[movements.length - 1].running_balance : balanceBroughtForward).toLocaleString()}
                </td>
                <td className="border border-gray-300 py-1.5 px-2 text-center text-xs text-emerald-900 font-black">
                  ยอดยกไป (Carried Forward)
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-4 text-right text-xs print:block hidden">
            <p>ผู้พิมพ์รายงาน: _____________________</p>
          </div>
        </div>
      )}
    </div>
  );
}
