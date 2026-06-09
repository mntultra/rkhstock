import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Borrowing } from '@/types';
import { ArrowLeftRight, Search, Plus, RotateCcw, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BorrowReturnPage() {
  const navigate = useNavigate();
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING'); // PENDING, PARTIAL, COMPLETED, ALL

  const fetchBorrowings = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('borrowings')
        .select(`
          *,
          products ( generic_name, trade_name ),
          officers ( full_name ),
          master_warehouses ( name )
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'ALL') {
        if (filterStatus === 'PENDING') {
          query = query.in('status', ['PENDING', 'PARTIAL']);
        } else {
          query = query.eq('status', filterStatus);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setBorrowings(data || []);
    } catch (err) {
      console.error('Error fetching borrowings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBorrowings();
  }, [filterStatus]);

  const filteredBorrowings = borrowings.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    const productName = (b.products?.generic_name || '') + ' ' + (b.products?.trade_name || '');
    const officerName = b.officers?.full_name || '';
    return productName.toLowerCase().includes(s) || officerName.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-emerald-100">
            <ArrowLeftRight className="text-emerald-600" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-emerald-950 tracking-tight">ระบบยืม-คืนเวชภัณฑ์</h1>
            <p className="text-sm font-medium text-emerald-600/80">ติดตามยอดค้างยืมและรับคืนเข้าคลัง</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/borrow/new')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-emerald-200 transition-all active:scale-95"
        >
          <Plus size={18} />
          ทำรายการยืมยา
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${filterStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            ค้างส่งคืน
          </button>
          <button
            onClick={() => setFilterStatus('COMPLETED')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${filterStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            คืนครบแล้ว
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${filterStatus === 'ALL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            ทั้งหมด
          </button>
        </div>

        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อเวชภัณฑ์, ผู้ยืม..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-emerald-50/50 border-b border-emerald-100">
              <tr>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 w-40">วันที่ยืม</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900">ผู้ยืม</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900">รายการเวชภัณฑ์</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 text-right">ยืมไป</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 text-right">คืนแล้ว</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 text-right">ค้างคืน</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 text-center">สถานะ</th>
                <th className="px-4 py-4 text-sm font-bold text-emerald-900 text-center w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="inline-block animate-spin w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
                    <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
                  </td>
                </tr>
              ) : filteredBorrowings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText className="text-gray-400" size={24} />
                    </div>
                    <p className="text-gray-500 font-bold">ไม่พบรายการยืม-คืน</p>
                  </td>
                </tr>
              ) : (
                filteredBorrowings.map(row => {
                  const pendingQty = row.borrowed_qty - row.returned_qty;
                  return (
                    <tr key={row.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(row.created_at || '')}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">
                        {row.officers?.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-700">
                        {row.products?.generic_name}
                        {row.products?.trade_name && <span className="block text-xs font-normal text-gray-500">{row.products.trade_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        {row.borrowed_qty}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">
                        {row.returned_qty}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-600 text-right">
                        {pendingQty > 0 ? pendingQty : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status === 'COMPLETED' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">คืนครบแล้ว</span>
                        ) : row.status === 'PARTIAL' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">ทยอยคืน</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold">ยังไม่คืน</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.status !== 'COMPLETED' && (
                          <button
                            onClick={() => navigate(`/borrow/return/${row.id}`)}
                            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors group relative"
                            title="รับคืนเวชภัณฑ์"
                          >
                            <RotateCcw size={18} />
                          </button>
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
    </div>
  );
}
