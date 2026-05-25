import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, AlertCircle } from 'lucide-react';

export default function StockBalancePage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      const { data, error } = await supabase
        .from('stock_balances')
        .select(`
          id, current_qty, lot_number, expiry_date,
          products ( generic_name, trade_name, drug_code )
        `)
        .gt('current_qty', 0)
        .order('expiry_date', { ascending: true });
        
      if (data) setBalances(data);
      setIsLoading(false);
    };
    fetchStock();
  }, []);

  const filteredBalances = balances.filter(b => 
    b.products?.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.products?.trade_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.lot_number?.toLowerCase().includes(search.toLowerCase())
  );

  // ฟังก์ชันคำนวณวันหมดอายุเพื่อไฮไลต์สี
  const getExpiryColor = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 90) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Header & Search */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">สต๊อกคงเหลือ</h1>
          <p className="text-sm text-gray-500 font-medium">ยอดคงเหลือเรียงตามวันหมดอายุ (FEFO) เพื่อการจัดการที่มีประสิทธิภาพ</p>
        </div>
        
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อยา, Trade Name, Lot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">รหัส / ชื่อยา</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">Lot Number</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">วันหมดอายุ</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right border-b border-gray-100">ยอดคงเหลือ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={4} className="p-10 text-center text-blue-600 font-bold animate-pulse">กำลังโหลดข้อมูลสต๊อก...</td></tr>
            ) : filteredBalances.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle size={32} className="text-gray-300" />
                    <p className="font-bold">ไม่พบรายการยาดังกล่าว</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBalances.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{item.products?.generic_name}</div>
                    <div className="text-xs text-gray-500 font-medium mt-1">
                      {item.products?.drug_code} <span className="mx-1">•</span> {item.products?.trade_name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                      {item.lot_number}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${getExpiryColor(item.expiry_date)}`}>
                      {new Date(item.expiry_date).toLocaleDateString('th-TH')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center justify-center px-4 py-1.5 text-base font-extrabold bg-blue-100 text-blue-700 rounded-xl shadow-inner">
                      {item.current_qty}
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
