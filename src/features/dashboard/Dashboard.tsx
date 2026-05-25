import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalItems: 0, criticalAlerts: 0, recentReceives: 0, recentDispenses: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // 1. ดึงจำนวนยาที่มีสต๊อก
      const { count: itemsCount } = await supabase.from('stock_balances').select('*', { count: 'exact', head: true }).gt('current_qty', 0);

      // 2. ดึงจำนวนการแจ้งเตือนวิกฤต (อายุ < 30 วัน)
      const { count: alertsCount } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('alert_level', 'CRITICAL').eq('is_read', false);

      // 3. ดึงยอดรับเข้าในเดือนนี้ (RECEIVE)
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count: receiveCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('movement_type', 'RECEIVE')
        .gte('created_at', startOfMonth);

      // 4. ดึงยอดจ่ายออกในเดือนนี้ (DISPENSE)
      const { count: dispenseCount } = await supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('movement_type', 'DISPENSE')
        .gte('created_at', startOfMonth);

      setStats({
        totalItems: itemsCount || 0,
        criticalAlerts: alertsCount || 0,
        recentReceives: receiveCount || 0,
        recentDispenses: dispenseCount || 0,
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">ภาพรวมระบบ (Dashboard)</h1>
        <p className="text-gray-500 mt-1">สรุปข้อมูลคลังยาย่อย ณ ปัจจุบัน</p>
      </div>

      {/* สถิติ 4 ช่อง */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Package size={28} /></div>
          <div>
            <p className="text-sm text-gray-500 font-bold mb-1">รายการยาในคลัง</p>
            <p className="text-3xl font-extrabold text-gray-800">{stats.totalItems}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl shadow-inner"><AlertTriangle size={28} /></div>
          <div>
            <p className="text-sm text-red-500 font-bold mb-1">
              ยาใกล้วิกฤต (&lt; 30 วัน)
            </p>
            <p className="text-3xl font-extrabold text-red-700">{stats.criticalAlerts}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><ArrowDownToLine size={28} /></div>
          <div>
            <p className="text-sm text-gray-500 font-bold mb-1">รับเข้าเดือนนี้</p>
            <p className="text-3xl font-extrabold text-gray-800">{stats.recentReceives} <span className="text-lg text-gray-400 font-medium">รายการ</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-md">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl shadow-inner"><ArrowUpFromLine size={28} /></div>
          <div>
            <p className="text-sm text-gray-500 font-bold mb-1">จ่ายออกเดือนนี้</p>
            <p className="text-3xl font-extrabold text-gray-800">{stats.recentDispenses} <span className="text-lg text-gray-400 font-medium">รายการ</span></p>
          </div>
        </div>
      </div>

      {/* เมนูด่วน */}
      <h2 className="text-xl font-extrabold text-gray-900 mt-10 mb-4 tracking-tight">เมนูด่วน (Quick Actions)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link to="/receive" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <ArrowDownToLine size={32} />
          </div>
          <span className="font-bold text-gray-700 text-lg">รับยาเข้าคลัง</span>
        </Link>
        <Link to="/dispense" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <ArrowUpFromLine size={32} />
          </div>
          <span className="font-bold text-gray-700 text-lg">ตัดจ่ายยา</span>
        </Link>
        <Link to="/stock" className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <Package size={32} />
          </div>
          <span className="font-bold text-gray-700 text-lg">เช็คสต๊อกคงเหลือ</span>
        </Link>
      </div>
    </div>
  );
}
