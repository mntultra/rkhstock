import { formatDate } from '@/utils/dateUtils';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { NotificationAlert } from '@/types';

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, products(generic_name)')
        .order('days_remaining', { ascending: true });
      if (data) setAlerts(data);
      setIsLoading(false);
    };
    fetchAlerts();
  }, []);

  const getAlertConfig = (level: string) => {
    if (level === 'CRITICAL') return {
      icon: <ShieldAlert className="text-red-500" size={28} />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      badge: 'bg-red-500 text-white shadow-red-200'
    };
    if (level === 'WARNING') return {
      icon: <AlertTriangle className="text-amber-500" size={28} />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badge: 'bg-amber-500 text-white shadow-amber-200'
    };
    return {
      icon: <Clock className="text-blue-500" size={28} />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'bg-blue-500 text-white shadow-blue-200'
    };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 sm:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">ศูนย์การแจ้งเตือน</h1>
            <p className="text-gray-400 font-medium">รายการเวชภัณฑ์ที่ใกล้หมดอายุจากระบบตรวจสอบรายวัน (pg_cron)</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl text-center">
            <p className="text-sm text-gray-300 font-bold mb-1">การแจ้งเตือนทั้งหมด</p>
            <p className="text-3xl font-extrabold text-white">{alerts.length}</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center p-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 font-bold">กำลังโหลดการแจ้งเตือน...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">ไม่พบการแจ้งเตือน</h3>
            <p className="text-gray-500 font-medium">ระบบคลังเวชภัณฑ์ของคุณอยู่ในสถานะที่ยอดเยี่ยม ไม่มีต๊อกที่ใกล้วิกฤต!</p>
          </div>
        ) : (
          alerts.map(alert => {
            const config = getAlertConfig(alert.alert_level);
            return (
              <div 
                key={alert.id} 
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 rounded-2xl border ${config.bg} ${config.border} transition-all hover:shadow-lg hover:-translate-y-1 group`}
              >
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                  {config.icon}
                </div>
                
                <div className="flex-1 w-full">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                    <h3 className="font-extrabold text-gray-900 text-lg">{alert.products?.generic_name}</h3>
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm tracking-wide ${config.badge}`}>
                      อีก {alert.days_remaining} วัน
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 font-medium">
                    <p>Lot Number: <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{alert.lot_number}</span></p>
                    <p>วันหมดอายุ: <span className="font-bold text-gray-900">{alert.expiry_date ? formatDate(alert.expiry_date) : '-'}</span></p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
