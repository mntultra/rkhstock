import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { AlertCircle, Calendar, Filter, Printer, Search, FileX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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

export default function UnfulfilledReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<UnfulfilledItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReport = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // ดึงข้อมูลใบเบิกที่ PENDING, PARTIAL, COMPLETED ภายในช่วงเวลา
      const { data: requisitions, error: reqError } = await supabase
        .from('requisitions')
        .select(`
          id, doc_no, doc_date, status,
          requester:officers!requester_id(full_name),
          items:requisition_items(
            qty, received_qty, remarks,
            product:products(drug_code, generic_name, master_dosage_forms(name_en, abbreviation), master_units(name:unit_name))
          )
        `)
        .gte('doc_date', startDate)
        .lte('doc_date', endDate)
        .neq('status', 'REJECTED')
        .order('doc_date', { ascending: false });

      if (reqError) throw reqError;

      const results: UnfulfilledItem[] = [];

      for (const req of (requisitions || [])) {
        for (const item of (req.items || [])) {
          const reqQty = Number(item.qty) || 0;
          const recQty = Number(item.received_qty) || 0;
          const missing = reqQty - recQty;

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
              unit_name: (item.product as any)?.master_units?.name || (item.product as any)?.master_units?.unit_name || '',
              remark: item.remarks || '-',
              status: req.status
            });
          }
        }
      }

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
  }, [startDate, endDate]);

  const filteredItems = items.filter(it => 
    it.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.requisition_doc_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.drug_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <FileX size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">รายงานรายการค้างจ่าย / ไม่ได้ของ</h1>
              <p className="text-sm text-gray-500 font-medium mt-1">
                แสดงรายการเวชภัณฑ์ที่ขอเบิกไป แต่คลังหลักจ่ายให้ไม่ครบ หรือไม่จ่ายให้เลย (จำนวนเป็น 0)
              </p>
            </div>
          </div>
          <Button onClick={() => window.print()} className="print:hidden bg-indigo-600 hover:bg-indigo-700" icon={<Printer size={18} />}>
            พิมพ์รายงาน
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl mb-6 print:hidden border border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ตั้งแต่วันที่</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <DatePicker value={startDate} onChange={setStartDate} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ถึงวันที่</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <DatePicker value={endDate} onChange={setEndDate} className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ค้นหา</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อยา, รหัสยา หรือเลขที่ใบเบิก..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 text-sm font-bold">{error}</div>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-extrabold text-gray-600">วันที่เบิก</th>
                <th className="px-4 py-3 font-extrabold text-gray-600">เลขที่ใบเบิก</th>
                <th className="px-4 py-3 font-extrabold text-gray-600">เวชภัณฑ์ (รูปแบบ)</th>
                <th className="px-4 py-3 font-extrabold text-gray-600 text-right">จำนวนเบิก</th>
                <th className="px-4 py-3 font-extrabold text-gray-600 text-right">ได้รับจริง</th>
                <th className="px-4 py-3 font-extrabold text-red-600 text-right bg-red-50/50">ยอดค้างจ่าย</th>
                <th className="px-4 py-3 font-extrabold text-gray-600">สถานะใบเบิก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-bold">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                      กำลังโหลดข้อมูล...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-bold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter size={32} className="text-gray-300" />
                      ไม่มีรายการค้างจ่ายในช่วงเวลานี้
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-gray-600 font-medium">
                      {formatDate(item.requisition_date)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {item.requisition_doc_no}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-gray-900">{item.generic_name}</div>
                      <div className="text-[11px] text-gray-500 font-bold mt-0.5 flex gap-2">
                        <span className="text-emerald-600">[{item.drug_code}]</span>
                        <span className="bg-gray-100 px-1.5 rounded">{item.dosage_form}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-600">
                      {item.requested_qty.toLocaleString()} <span className="text-xs font-medium">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {item.received_qty.toLocaleString()} <span className="text-xs font-medium">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600 bg-red-50/30 group-hover:bg-red-50/80 transition-colors">
                      {item.missing_qty.toLocaleString()} <span className="text-xs font-bold">{item.unit_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'COMPLETED' ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">เสร็จสิ้น</span>
                      ) : item.status === 'PARTIAL' ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">รับบางส่วน</span>
                      ) : (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">รอรับ</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
