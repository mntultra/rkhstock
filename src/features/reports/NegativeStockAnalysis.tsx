import { formatDate } from '@/utils/dateUtils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle, ChevronDown, ChevronUp, Search,
  Wrench, Info, AlertCircle, CheckCircle2, RefreshCw,
  FlaskConical, ArrowRightLeft, FileX, Clock, Database
} from 'lucide-react';

interface NegItem {
  id: string;
  product_id: string;
  lot_number: string;
  expiry_date: string;
  current_qty: number;
  warehouse_id: string;
  products: {
    generic_name: string;
    trade_name?: string;
    drug_code?: string;
  } | null;
}

interface MovementItem {
  movement_type: string;
  doc_date: string;
  lot_number: string;
  qty: number;
  movement_id: string;
}

interface AnalysisResult {
  item: NegItem;
  cause: string;
  causeCode: 'CROSS_LOT' | 'OVER_ISSUE' | 'IMPORT_ERROR' | 'MANUAL_ADJUST' | 'UNKNOWN';
  detail: string;
  fix: string;
  movements: MovementItem[];
  expanded: boolean;
}

const CAUSE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CROSS_LOT:      { label: 'ตัดต่าง Lot', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <ArrowRightLeft size={16} /> },
  OVER_ISSUE:  { label: 'จ่ายเกินสต็อก', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: <AlertTriangle size={16} /> },
  IMPORT_ERROR:   { label: 'นำเข้าข้อมูลผิด', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <FileX size={16} /> },
  MANUAL_ADJUST:  { label: 'ปรับมือ (Manual)', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: <Wrench size={16} /> },
  UNKNOWN:        { label: 'ไม่ทราบสาเหตุ',  color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',     icon: <FlaskConical size={16} /> },
};

function detectCause(movements: MovementItem[], item: NegItem): Pick<AnalysisResult, 'cause' | 'causeCode' | 'detail' | 'fix'> {
  const receives = movements.filter(m => m.movement_type === 'RECEIVE');
  const issues = movements.filter(m => m.movement_type === 'ISSUE');
  const adjusts  = movements.filter(m => m.movement_type === 'ADJUST');

  // Case 1: มีการ ISSUE โดยไม่มี RECEIVE ใน lot เดียวกัน → ตัดผิด lot
  const hasReceiveForLot = receives.some(r => r.lot_number === item.lot_number);
  const hasIssueForLot = issues.some(d => d.lot_number === item.lot_number);
  if (hasIssueForLot && !hasReceiveForLot) {
    const otherLots = [...new Set(receives.map(r => r.lot_number))].join(', ');
    return {
      causeCode: 'CROSS_LOT',
      cause: 'ตัดจ่ายผิด Lot',
      detail: `Lot "${item.lot_number}" ไม่มีบันทึกรับเข้า (RECEIVE) แต่มีการตัดจ่าย (ISSUE)\nLot ที่มีการรับจริง: ${otherLots || '-'}`,
      fix: '① แก้ไขใน Excel ก่อนนำเข้า: เปลี่ยน Lot Number ในคอลัมน์ Lot ให้ตรงกับล็อตที่รับจริง\n② หรือเข้าหน้า "ปรับยอดสต็อก" แล้วเพิ่ม RECEIVE ย้อนหลังให้ถูก Lot\n③ ลบ ISSUE ที่ผิด lot แล้วบันทึกใหม่ให้ถูกต้อง'
    };
  }

  // Case 2: Issue รวมมากกว่า Receive รวม → จ่ายเกิน
  const totalReceive = receives.reduce((s, m) => s + m.qty, 0);
  const totalIssue = issues.reduce((s, m) => s + m.qty, 0);
  if (totalIssue > totalReceive && totalReceive > 0) {
    return {
      causeCode: 'OVER_ISSUE',
      cause: 'จ่ายเกินยอดรับ',
      detail: `รับเข้ารวม: ${totalReceive} | จ่ายออกรวม: ${totalIssue} | ส่วนเกิน: ${totalIssue - totalReceive}`,
      fix: '① ตรวจสอบใบรับเข้า (RECEIVE) ว่าครบถ้วนหรือไม่ อาจมีใบรับที่ยังไม่ได้บันทึก\n② แก้ไขจำนวนใน Excel ก่อนนำเข้า ให้ไม่เกินยอดคงเหลือจริง\n③ ถ้าจ่ายผิดจำนวน ให้ Void เอกสารจ่ายแล้วบันทึกใหม่'
    };
  }

  // Case 3: มีแต่ ADJUST ลบ → ปรับมือผิดพลาด
  if (adjusts.length > 0 && receives.length === 0) {
    return {
      causeCode: 'MANUAL_ADJUST',
      cause: 'ปรับยอดแบบ Manual (ไม่มีใบรับ)',
      detail: `พบ ${adjusts.length} รายการปรับยอด (ADJUST) โดยไม่มี RECEIVE\nอาจเป็นการปรับลดโดยไม่ได้บันทึกรับก่อน`,
      fix: '① เข้าหน้า "ปรับยอดสต็อก" แล้ว ADJUST เพิ่มยอดให้ถูกต้อง\n② บันทึก RECEIVE ย้อนหลังก่อน แล้วค่อย ADJUST'
    };
  }

  // Case 4: ไม่มี movement เลย → import ผิด
  if (movements.length === 0) {
    return {
      causeCode: 'IMPORT_ERROR',
      cause: 'ไม่มีประวัติ Movement',
      detail: 'ไม่พบ stock_movement_items สำหรับ product_id + lot_number นี้เลย อาจเกิดจากการ import ข้อมูลผิดพลาด หรือมีการแก้ไข DB โดยตรง',
      fix: '① ตรวจสอบ stock_balances โดยตรงใน Supabase Dashboard\n② ลบ record ที่ผิดออกจาก stock_balances แล้ว RECEIVE ใหม่ผ่านระบบ\n③ แก้ไข current_qty ใน SQL: UPDATE stock_balances SET current_qty = <ค่าที่ถูก> WHERE id = \'<id>\''
    };
  }

  return {
    causeCode: 'UNKNOWN',
    cause: 'ไม่ทราบสาเหตุ / ซับซ้อน',
    detail: `รับ: ${totalReceive}, จ่าย: ${totalIssue}, ปรับ: ${adjusts.length} ครั้ง\nต้องตรวจสอบ timeline เพิ่มเติม`,
    fix: '① ดูประวัติ Movement ทั้งหมดในหน้า "รายงานความเคลื่อนไหว"\n② เปรียบเทียบยอดรับ-จ่ายทีละรายการ\n③ ปรับยอดใน "ปรับยอดสต็อก" ให้ตรงความเป็นจริง'
  };
}

export default function NegativeStockAnalysis() {
  const [items, setItems] = useState<NegItem[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCause, setFilterCause] = useState<string>('ALL');

  useEffect(() => {
    const fetchNeg = async () => {
      const { data } = await supabase
        .from('stock_balances')
        .select('id, product_id, lots!inner(id, lot_number, expiry_date), current_qty, warehouse_id, products(generic_name, trade_name, drug_code)')
        .lt('current_qty', 0);
      
      const mappedData = (data || []).map((b: any) => ({
        ...b,
        lot_id: b.lots?.id,
        lot_number: b.lots?.lot_number,
        expiry_date: b.lots?.expiry_date
      }));
      setItems(mappedData);
      setIsLoading(false);
    };
    fetchNeg();
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const analysisResults: AnalysisResult[] = [];

    for (const item of items) {
      const { data: mvData } = await supabase
        .from('stock_movement_items')
        .select('movement_type:stock_movements(movement_type), doc_date:stock_movements(doc_date), lots(lot_number), qty, movement_id')
        .eq('product_id', item.product_id)
        .eq('lot_id', (item as any).lot_id);

      const movements: MovementItem[] = (mvData || []).map((m: any) => ({
        movement_type: m.movement_type?.movement_type || m.movement_type,
        doc_date: m.doc_date?.doc_date || m.doc_date,
        lot_number: m.lots?.lot_number || '-',
        qty: m.qty,
        movement_id: m.movement_id,
      }));

      const causeInfo = detectCause(movements, item);
      analysisResults.push({
        item,
        ...causeInfo,
        movements,
        expanded: false,
      });
    }

    setResults(analysisResults);
    setIsAnalyzing(false);
  };

  const toggleExpand = (idx: number) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r));
  };

  const filtered = results.filter(r => {
    const p = r.item.products;
    const matchSearch =
      p?.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      p?.drug_code?.toLowerCase().includes(search.toLowerCase()) ||
      r.item.lot_number?.toLowerCase().includes(search.toLowerCase());
    const matchCause = filterCause === 'ALL' || r.causeCode === filterCause;
    return matchSearch && matchCause;
  });

  const countByCause = (code: string) => results.filter(r => r.causeCode === code).length;

  return (
    <div className="max-w-full mx-auto pb-20 space-y-6">
      {/* DEV Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-lg">
        <FlaskConical size={24} className="shrink-0" />
        <div>
          <p className="font-black text-lg">🛠️ Developer Analysis Mode</p>
          <p className="text-amber-100 text-sm font-medium">หน้านี้สำหรับนักพัฒนาเท่านั้น — วิเคราะห์สาเหตุยอดคงคลังติดลบ (ชั่วคราว)</p>
        </div>
        <span className="ml-auto bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/30">DEV ONLY</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Database size={22} className="text-orange-500" />
            วิเคราะห์สาเหตุยอดติดลบ
          </h1>
          <p className="text-sm text-gray-500 mt-1">พบ <span className="font-black text-red-600">{items.length}</span> รายการที่มียอดคงคลัง &lt; 0 — กด "เริ่มวิเคราะห์" เพื่อตรวจ</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={isLoading || isAnalyzing || items.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <RefreshCw size={18} className={isAnalyzing ? 'animate-spin' : ''} />
          {isAnalyzing ? 'กำลังวิเคราะห์...' : 'เริ่มวิเคราะห์'}
        </button>
      </div>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(CAUSE_META).map(([code, meta]) => (
            <button
              key={code}
              onClick={() => setFilterCause(filterCause === code ? 'ALL' : code)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                filterCause === code ? `${meta.bg} border-current ${meta.color} shadow-md scale-[1.02]` : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`flex items-center gap-1.5 mb-1 font-bold text-xs ${filterCause === code ? meta.color : 'text-gray-500'}`}>
                {meta.icon} {meta.label}
              </div>
              <p className={`text-2xl font-black ${filterCause === code ? meta.color : 'text-gray-900'}`}>{countByCause(code)}</p>
              <p className="text-xs text-gray-400 font-medium">รายการ</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {results.length > 0 && (
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อยา, รหัส, Lot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
            />
          </div>
          {filterCause !== 'ALL' && (
            <button onClick={() => setFilterCause('ALL')} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-blue-600 font-bold animate-pulse border border-gray-100">กำลังโหลดข้อมูล...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
          <p className="font-black text-gray-700 text-lg">ไม่พบรายการยอดติดลบ 🎉</p>
          <p className="text-gray-400 text-sm mt-1">สต็อกทุก lot อยู่ในเกณฑ์ปกติ</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Info size={40} className="text-orange-300 mx-auto mb-3" />
          <p className="font-bold text-gray-500">กด "เริ่มวิเคราะห์" เพื่อตรวจสอบสาเหตุแต่ละรายการ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, idx) => {
            const meta = CAUSE_META[r.causeCode];
            const p = r.item.products;
            return (
              <div key={r.item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Row Header */}
                <button
                  className="w-full text-left px-6 py-4 flex items-start gap-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(idx)}
                >
                  {/* Index */}
                  <span className="mt-0.5 w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Drug info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-sm">{p?.generic_name}</span>
                      {p?.drug_code && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">{p.drug_code}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>Lot: <span className="font-mono font-bold text-gray-700">{r.item.lot_number}</span></span>
                      <span>Exp: {r.item.expiry_date ? formatDate(r.item.expiry_date) : '-'}</span>
                      <span className="font-black text-red-600">ยอดคงเหลือ: {r.item.current_qty}</span>
                    </div>
                  </div>

                  {/* Cause Badge */}
                  <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${meta.bg} ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </div>

                  {/* Expand icon */}
                  <div className="shrink-0 text-gray-400 mt-1">
                    {r.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {/* Expanded Details */}
                {r.expanded && (
                  <div className="px-6 pb-6 border-t border-gray-100 bg-gray-50/30 space-y-4 pt-4">
                    {/* Cause Detail */}
                    <div className={`rounded-xl border p-4 ${meta.bg}`}>
                      <p className={`text-xs font-black uppercase tracking-wider mb-1 ${meta.color}`}>🔍 สาเหตุที่ตรวจพบ</p>
                      <p className="text-sm font-bold text-gray-800 whitespace-pre-line">{r.detail}</p>
                    </div>

                    {/* Fix Guide */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">🔧 แนวทางแก้ไข</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{r.fix}</p>
                    </div>

                    {/* SQL Hint */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wider text-blue-700 mb-2">💾 SQL สำหรับตรวจสอบ / แก้ไขใน Supabase</p>
                      <pre className="text-xs font-mono text-blue-900 whitespace-pre-wrap bg-blue-100/50 rounded-lg p-3 leading-relaxed">{`-- ดูยอดสต็อกปัจจุบัน
SELECT * FROM stock_balances
WHERE product_id = '${r.item.product_id}'
  AND lot_number = '${r.item.lot_number}';

-- ดู Movement ทั้งหมดของ lot นี้
SELECT smi.*, sm.movement_type, sm.doc_date
FROM stock_movement_items smi
JOIN stock_movements sm ON sm.id = smi.movement_id
WHERE smi.product_id = '${r.item.product_id}'
  AND smi.lot_number = '${r.item.lot_number}'
ORDER BY sm.doc_date;

-- แก้ไขยอด (ใช้เมื่อตรวจสอบแล้วว่าถูกต้อง)
UPDATE stock_balances
SET current_qty = <จำนวนที่ถูกต้อง>
WHERE id = '${r.item.id}';`}</pre>
                    </div>

                    {/* Movement Timeline */}
                    {r.movements.length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">📋 ประวัติ Movement ({r.movements.length} รายการ)</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-100 text-gray-500 font-bold">
                                <th className="px-3 py-2 text-left">ประเภท</th>
                                <th className="px-3 py-2 text-left">วันที่</th>
                                <th className="px-3 py-2 text-left">Lot</th>
                                <th className="px-3 py-2 text-right">จำนวน</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {r.movements.map((m, mi) => {
                                const typeColor = m.movement_type === 'RECEIVE' ? 'text-emerald-700 bg-emerald-50' :
                                  m.movement_type === 'ISSUE' ? 'text-red-700 bg-red-50' :
                                  'text-blue-700 bg-blue-50';
                                return (
                                  <tr key={mi} className="bg-white hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${typeColor}`}>{m.movement_type}</span>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-gray-600">{m.doc_date ? formatDate(m.doc_date) : '-'}</td>
                                    <td className="px-3 py-2 font-mono text-gray-700">{m.lot_number}</td>
                                    <td className="px-3 py-2 text-right font-black text-gray-900">{m.qty}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {r.movements.length === 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 rounded-xl px-4 py-3">
                        <AlertCircle size={16} className="text-gray-400" />
                        ไม่พบประวัติ Movement — อาจเกิดจากการ import ข้อมูลโดยตรง
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Clock size={12} />
                      วิเคราะห์เมื่อ: {new Date().toLocaleString('th-TH')} · stock_balance id: <span className="font-mono">{r.item.id}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
