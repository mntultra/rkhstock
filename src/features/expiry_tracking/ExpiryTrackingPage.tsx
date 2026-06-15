import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, AlertTriangle, Clock, Search, Filter, Plus, Calendar } from 'lucide-react';
import AddManualExpiryModal from './AddManualExpiryModal';
import { formatDate } from '@/utils/dateUtils';
import { useWarehouses } from '@/hooks/useWarehouses';

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

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden animate-fade-in-up">
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
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 hover:scale-105 transition-all shadow-md"
          >
            <Plus size={20} strokeWidth={3} />
            เพิ่มรายการยาที่ชั้นจุดจ่าย
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
