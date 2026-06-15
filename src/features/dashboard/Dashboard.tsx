import { DatePicker } from '@/components/ui/DatePicker';
import { formatDate } from '@/utils/dateUtils';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, 
  AlertTriangle, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Clock, 
  Boxes,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Activity,
  Award,
  Coins,
  ShieldAlert,
  FileText,
  Layers,
  CalendarRange,
  ThermometerSnowflake,
  HeartPulse,
  History,
  RotateCcw,
  ClipboardList,
  Pill
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ 
    totalActiveProducts: 0, 
    criticalAlerts: 0, 
    recentReceives: 0, 
    recentDispenses: 0,
    recentDisposals: 0,
    totalInHandQty: 0,
    totalStockValue: 0,
    activeBorrowings: 0,
    pendingRequisitions: 0,
    highAlertCount: 0,
    psychoNarcoCount: 0,
    coldStorageCount: 0,
    totalActiveLots: 0,
    fulfillmentRate: 100
  });

  const [expiryHeatmap, setExpiryHeatmap] = useState<any[]>([]);
  const [expiryStats, setExpiryStats] = useState({
    total: 0,
    expired: 0,
    warning: 0,
    safe: 0,
    systemCount: 0,
    manualCount: 0,
    warningMonths: 6
  });

  const statusSegments = useMemo(() => {
    const total = expiryStats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'SAFE', value: expiryStats.safe, color: '#10b981', label: 'ปลอดภัย' },
      { key: 'WARNING', value: expiryStats.warning, color: '#f59e0b', label: 'ใกล้หมดอายุ' },
      { key: 'EXPIRED', value: expiryStats.expired, color: '#f43f5e', label: 'หมดอายุแล้ว' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 34; // Radius = 34
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [expiryStats]);

  const locationSegments = useMemo(() => {
    const total = expiryStats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'MANUAL', value: expiryStats.manualCount, color: '#d946ef', label: 'ชั้นจุดจ่าย' },
      { key: 'SYSTEM', value: expiryStats.systemCount, color: '#3b82f6', label: 'สต๊อก' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 34; // Radius = 34
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [expiryStats]);

  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [deadStock, setDeadStock] = useState<any[]>([]);
  const [topMoving, setTopMoving] = useState<any[]>([]);
  const [recentRequisitions, setRecentRequisitions] = useState<any[]>([]);
  const [recentBorrowings, setRecentBorrowings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [filterType, setFilterType] = useState<'month' | '30days' | 'fiscal' | 'custom'>('month');
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(''); // fiscal year ID
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Calculate Date Boundaries
      let startDate = '';
      let endDate = '';

      if (filterType === 'month') {
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      } else if (filterType === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      } else if (filterType === 'fiscal') {
        const selectedFY = fiscalYears.find(fy => fy.id === selectedFiscalYear);
        if (selectedFY && selectedFY.start_date && selectedFY.end_date) {
          startDate = new Date(selectedFY.start_date).toISOString();
          endDate = new Date(selectedFY.end_date).toISOString();
        } else if (selectedFY) {
          // Fallback: Thai Fiscal Year calculation
          const fyNum = parseInt(selectedFY.year_name) || new Date().getFullYear() + 543;
          const calendarYear = fyNum - 543;
          startDate = new Date(calendarYear - 1, 9, 1).toISOString(); // Oct 1
          endDate = new Date(calendarYear, 8, 30, 23, 59, 59).toISOString(); // Sep 30
        }
      } else if (filterType === 'custom') {
        startDate = customStartDate ? new Date(customStartDate).toISOString() : '';
        endDate = customEndDate ? new Date(customEndDate).toISOString() : '';
      }

      // 1. ดึงจำนวนรายการเวชภัณฑ์ทั้งหมดที่เป็นแอคทีฟ (Active Products)
      const { count: activeProductsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // 2. ดึงจำนวนการแจ้งเตือนวิกฤต (ระดับ CRITICAL และยังไม่ได้อ่าน)
      const { count: alertsCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('alert_level', 'CRITICAL')
        .eq('is_read', false);

      // 3. ดึงยอดรับเข้าตามช่วงเวลา (RECEIVE)
      let queryReceive = supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('movement_type', 'RECEIVE')
        .eq('is_voided', false);
      if (startDate) queryReceive = queryReceive.gte('created_at', startDate);
      if (endDate) queryReceive = queryReceive.lte('created_at', endDate);
      const { count: receiveCount } = await queryReceive;

      // 4. ดึงยอดจ่ายออกตามช่วงเวลา (DISPENSE)
      let queryDispense = supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .eq('movement_type', 'DISPENSE')
        .eq('is_voided', false);
      if (startDate) queryDispense = queryDispense.gte('created_at', startDate);
      if (endDate) queryDispense = queryDispense.lte('created_at', endDate);
      const { count: dispenseCount } = await queryDispense;

      // 5. ดึงยอดตัดจำหน่ายตามช่วงเวลา (DISPOSE)
      let queryDispose = supabase
        .from('stock_movements')
        .select('*', { count: 'exact', head: true })
        .in('movement_type', ['DISPOSE', 'EXPIRED'])
        .eq('is_voided', false);
      if (startDate) queryDispose = queryDispose.gte('created_at', startDate);
      if (endDate) queryDispose = queryDispose.lte('created_at', endDate);
      const { count: disposeCount } = await queryDispose;

      // 6. คำนวณจำนวนชิ้นคงคลัง, มูลค่าสต๊อกรวม และจำนวนล็อตคลังทั้งหมด (Qty In Hand & Lots & Value)
      const { data: inHandData } = await supabase
        .from('stock_balances')
        .select('current_qty, lots(unit_price), products(unit_price)')
        .gt('current_qty', 0);

      let qtySum = 0;
      let valueSum = 0;
      let activeLotsCount = 0;
      if (inHandData) {
        activeLotsCount = inHandData.length;
        inHandData.forEach((item: any) => {
          const qty = item.current_qty || 0;
          const price = item.lots?.unit_price || item.products?.unit_price || 0;
          qtySum += qty;
          valueSum += qty * price;
        });
      }

      // 7. ดึงข้อมูลเวชภัณฑ์ค้างยืม (Active Borrowings)
      const { count: activeBorrowingsCount } = await supabase
        .from('borrowings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'PARTIAL']);

      // 8. ดึงข้อมูลใบเบิกเวชภัณฑ์รออนุมัติหรือฉบับร่าง (Pending Requisitions)
      const { count: pendingRequisitionsCount } = await supabase
        .from('requisitions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['DRAFT', 'PENDING']);

      // 8.1 คำนวณ Fulfillment Rate (รับจริง vs เบิก) จากใบเบิกที่เสร็จสิ้นแล้วตามช่วงเวลา
      let queryCompleted = supabase
        .from('requisitions')
        .select(`requisition_items(qty, received_qty)`)
        .eq('status', 'COMPLETED');
      if (startDate) queryCompleted = queryCompleted.gte('created_at', startDate);
      if (endDate) queryCompleted = queryCompleted.lte('created_at', endDate);
      const { data: completedReqs } = await queryCompleted;
      
      let totalReqQty = 0;
      let totalRecvQty = 0;
      if (completedReqs) {
        completedReqs.forEach((req: any) => {
          req.requisition_items?.forEach((item: any) => {
            totalReqQty += (item.qty || 0);
            totalRecvQty += (item.received_qty || 0);
          });
        });
      }
      const fulfillmentRate = totalReqQty > 0 ? Math.round((totalRecvQty / totalReqQty) * 100) : 100;

      // 9. ดึงข้อมูลเวชภัณฑ์เฝ้าระวังพิเศษ (High Alert, Psycho/Narco, Cold Storage)
      const { count: highAlertCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_high_alert', true)
        .eq('is_active', true);

      const { count: psychoNarcoCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_psycho_narco', true)
        .eq('is_active', true);

      const { count: coldStorageCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_cold_storage', true)
        .eq('is_active', true);

      // 10. ดึงข้อมูลใบเบิกเวชภัณฑ์ล่าสุด 5 รายการตามช่วงเวลา
      let queryRecentReqs = supabase
        .from('requisitions')
        .select(`
          id, doc_no, doc_date, status,
          requester:officers!requester_id ( full_name ),
          approver:officers!approver_id ( full_name )
        `);
      if (startDate) queryRecentReqs = queryRecentReqs.gte('created_at', startDate);
      if (endDate) queryRecentReqs = queryRecentReqs.lte('created_at', endDate);
      queryRecentReqs = queryRecentReqs.order('created_at', { ascending: false }).limit(5);
      const { data: recentRequisitionsData } = await queryRecentReqs;
      
      if (recentRequisitionsData) {
        setRecentRequisitions(recentRequisitionsData);
      }

      // 11. ดึงข้อมูลการยืมเวชภัณฑ์ค้างส่งคืนล่าสุด 5 รายการตามช่วงเวลา
      let queryBorrow = supabase
        .from('borrowings')
        .select(`
          id, borrowed_qty, returned_qty, status, created_at,
          products ( generic_name, trade_name ),
          officers ( full_name )
        `)
        .in('status', ['PENDING', 'PARTIAL']);
      if (startDate) queryBorrow = queryBorrow.gte('created_at', startDate);
      if (endDate) queryBorrow = queryBorrow.lte('created_at', endDate);
      queryBorrow = queryBorrow.order('created_at', { ascending: false }).limit(5);
      const { data: activeBorrowingsData } = await queryBorrow;

      if (activeBorrowingsData) {
        setRecentBorrowings(activeBorrowingsData);
      }

      // 12. ดึงข้อมูลเวชภัณฑ์ใกล้หมดอายุใน 6 เดือนถัดไปสำหรับทำ Heatmap
      const today = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(today.getMonth() + 6);
      
      const { data: expiringLotsData } = await supabase
        .from('stock_balances')
        .select(`
          current_qty, product_id,
          lots!inner ( lot_number, expiry_date ),
          products ( generic_name )
        `)
        .gt('current_qty', 0)
        .gte('lots.expiry_date', today.toISOString().split('T')[0])
        .lte('lots.expiry_date', sixMonthsLater.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true, referencedTable: 'lots' });

      const monthsList: any[] = [];
      for (let i = 0; i < 6; i++) {
        const m = new Date();
        m.setMonth(today.getMonth() + i);
        const monthYearKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
        monthsList.push({
          key: monthYearKey,
          label: formatDate(m),
          items: [] as any[]
        });
      }

      if (expiringLotsData) {
        expiringLotsData.forEach((item: any) => {
          const lot = item.lots;
          if (!lot || !lot.expiry_date) return;
          const expDate = new Date(lot.expiry_date);
          const key = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
          const monthObj = monthsList.find(m => m.key === key);
          if (monthObj) {
            monthObj.pushItems = monthObj.items.push({
              product_name: item.products?.generic_name || 'Unknown',
              lot_number: lot.lot_number,
              current_qty: item.current_qty,
              expiry_date: lot.expiry_date
            });
          }
        });
      }

      // 13. BI Analytics Data Fetching
      // 13.1 Low Stock Alerts
      const { data: allProducts } = await supabase
        .from('products')
        .select(`id, generic_name, reorder_point, stock_balances(current_qty)`)
        .eq('is_active', true);
      
      const lowStocks: any[] = [];
      if (allProducts) {
        allProducts.forEach((p: any) => {
          const totalQty = p.stock_balances?.reduce((sum: number, b: any) => sum + (b.current_qty || 0), 0) || 0;
          if (p.reorder_point > 0 && totalQty <= p.reorder_point) {
            lowStocks.push({ id: p.id, name: p.generic_name, totalQty, reorderPoint: p.reorder_point });
          }
        });
      }
      setLowStockAlerts(lowStocks);

      // 13.2 Top Moving & Dead Stock based on selected period
      let queryDispenseItems = supabase
        .from('stock_movement_items')
        .select(`product_id, qty, products(generic_name), stock_movements!inner(created_at, movement_type)`)
        .eq('stock_movements.movement_type', 'DISPENSE');
      if (startDate) queryDispenseItems = queryDispenseItems.gte('stock_movements.created_at', startDate);
      if (endDate) queryDispenseItems = queryDispenseItems.lte('stock_movements.created_at', endDate);
      const { data: recentDispenseItems } = await queryDispenseItems;

      const topMovingMap = new Map();
      const activeDispenseInPeriod = new Set();

      if (recentDispenseItems) {
        recentDispenseItems.forEach((item: any) => {
          activeDispenseInPeriod.add(item.product_id);
          const currentSum = topMovingMap.get(item.product_id) || { name: item.products?.generic_name, qty: 0 };
          topMovingMap.set(item.product_id, { name: item.products?.generic_name, qty: currentSum.qty + (item.qty || 0) });
        });
      }
      const sortedTopMoving = Array.from(topMovingMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 3);
      setTopMoving(sortedTopMoving);

      const deadStocks: any[] = [];
      if (allProducts) {
        allProducts.forEach((p: any) => {
           const totalQty = p.stock_balances?.reduce((sum: number, b: any) => sum + (b.current_qty || 0), 0) || 0;
           if (totalQty > 0 && !activeDispenseInPeriod.has(p.id)) {
              deadStocks.push({ id: p.id, name: p.generic_name, qty: totalQty });
           }
        });
      }
      // 13.3 Expiry Summary calculations
      const { data: orgData } = await supabase.from('organization_info').select('expiry_warning_months').limit(1);
      const warningMonthsVal = orgData?.[0]?.expiry_warning_months ?? 6;
      const warningDays = warningMonthsVal * 30;

      const { data: systemStock } = await supabase
        .from('stock_balances')
        .select('current_qty, lots!inner ( expiry_date )')
        .gt('current_qty', 0)
        .not('lots.expiry_date', 'is', null);

      const { data: manualStock } = await supabase
        .from('manual_expirations')
        .select('qty, expiry_date');

      let total = 0;
      let expired = 0;
      let warning = 0;
      let safe = 0;
      let systemCount = 0;
      let manualCount = 0;

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      systemStock?.forEach((item: any) => {
        if (!item.lots?.expiry_date) return;
        const expDate = new Date(item.lots.expiry_date);
        const diffTime = expDate.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        total++;
        systemCount++;
        if (diffDays <= 0) {
          expired++;
        } else if (diffDays <= warningDays) {
          warning++;
        } else {
          safe++;
        }
      });

      manualStock?.forEach((item: any) => {
        if (!item.expiry_date) return;
        const expDate = new Date(item.expiry_date);
        const diffTime = expDate.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        total++;
        manualCount++;
        if (diffDays <= 0) {
          expired++;
        } else if (diffDays <= warningDays) {
          warning++;
        } else {
          safe++;
        }
      });

      setExpiryStats({
        total,
        expired,
        warning,
        safe,
        systemCount,
        manualCount,
        warningMonths: warningMonthsVal
      });

      setDeadStock(deadStocks);

      // อัปเดต State สรุป
      setStats({
        totalActiveProducts: activeProductsCount || 0,
        criticalAlerts: alertsCount || 0,
        recentReceives: receiveCount || 0,
        recentDispenses: dispenseCount || 0,
        recentDisposals: disposeCount || 0,
        totalInHandQty: qtySum,
        totalStockValue: valueSum,
        activeBorrowings: activeBorrowingsCount || 0,
        pendingRequisitions: pendingRequisitionsCount || 0,
        highAlertCount: highAlertCount || 0,
        psychoNarcoCount: psychoNarcoCount || 0,
        coldStorageCount: coldStorageCount || 0,
        totalActiveLots: activeLotsCount || 0,
        fulfillmentRate: fulfillmentRate
      });
      setExpiryHeatmap(monthsList);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Fiscal Years on Mount
  useEffect(() => {
    const fetchFiscalYears = async () => {
      const { data } = await supabase.from('master_fiscal_years').select('*').order('year_name', { ascending: false });
      if (data) {
        setFiscalYears(data);
        const activeFY = data.find(fy => fy.is_active);
        if (activeFY) {
          setSelectedFiscalYear(activeFY.id);
        } else if (data.length > 0) {
          setSelectedFiscalYear(data[0].id);
        }
      }
    };
    fetchFiscalYears();
  }, []);

  useEffect(() => {
    // Only run if the fiscal years load completes when filterType is set to 'fiscal'
    if (filterType === 'fiscal' && fiscalYears.length === 0) return;
    fetchStats();
  }, [filterType, selectedFiscalYear, customStartDate, customEndDate]);

  // คำนวณร้อยละรายการเวชภัณฑ์พร้อมใช้ในคลัง (เป้าหมาย 90% ขึ้นไป)
  const activePercentage = stats.totalActiveProducts > 0 
    ? Math.min(Math.round(((stats.totalActiveProducts - lowStockAlerts.length) / stats.totalActiveProducts) * 100), 100)
    : 92;

  // สำหรับ SVG Circular progress bar
  const radius = 40;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (activePercentage / 100) * circumference;

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-black text-emerald-950 tracking-tight flex items-center gap-3">
            <HeartPulse className="w-8 h-8 text-emerald-600 animate-pulse" />
            ภาพรวมงานบริหารคลังเวชภัณฑ์
          </h1>
          <p className="text-sm text-emerald-700 font-medium mt-1">ระบบติดตามสถานะสต๊อกเวชภัณฑ์ ความเสี่ยงล็อตหมดอายุ การยืม-คืน และกิจกรรมเคลื่อนไหว</p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={fetchStats}
            className="glass px-3.5 py-2 rounded-full text-xs font-bold text-emerald-800 shadow-sm border border-emerald-100 hover:bg-emerald-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="ดึงข้อมูลใหม่"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            รีเฟรชข้อมูล
          </button>
          <div className="glass px-4 py-2 rounded-full text-xs font-bold text-emerald-800 shadow-sm border border-emerald-100 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />
            อัปเดตแบบเรียลไทม์
          </div>
        </div>
      </div>

      {/* Filter Control Bar (Premium glassmorphic container) */}
      <div className="glass p-5 rounded-3xl border border-emerald-100/70 shadow-sm bg-gradient-to-r from-white to-emerald-50/20 flex flex-wrap gap-4 items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-800/50 font-bold uppercase tracking-wider block">การแสดงผลสถิติและวิเคราะห์คลัง</span>
            <span className="text-sm font-extrabold text-emerald-950">เลือกกรองข้อมูลตามรอบช่วงเวลา / ปีงบประมาณ</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Main Filter Dropdown */}
          <div className="flex flex-col gap-1 w-full sm:w-44">
            <label className="text-[10px] font-bold text-emerald-800/60 uppercase">ประเภทการกรอง</label>
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="px-3.5 py-2 bg-white border border-emerald-150 rounded-xl font-bold text-xs text-emerald-850 focus:ring-4 focus:ring-emerald-50 outline-none cursor-pointer shadow-sm transition-all"
            >
              <option value="month">เดือนนี้ (This Month)</option>
              <option value="30days">30 วันที่ผ่านมา</option>
              <option value="fiscal">ตามปีงบประมาณ</option>
              <option value="custom">กำหนดช่วงวันที่เอง</option>
            </select>
          </div>

          {/* Fiscal Year Selector (visible when 'fiscal' filter is chosen) */}
          {filterType === 'fiscal' && (
            <div className="flex flex-col gap-1 w-full sm:w-48 animate-fade-in-down">
              <label className="text-[10px] font-bold text-emerald-800/60 uppercase">เลือกปีงบประมาณ</label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                className="px-3.5 py-2 bg-white border border-emerald-150 rounded-xl font-bold text-xs text-emerald-850 focus:ring-4 focus:ring-emerald-50 outline-none cursor-pointer shadow-sm"
              >
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    ปีงบประมาณ {fy.year_name} {fy.is_active ? '(ปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Ranges (visible when 'custom' filter is chosen) */}
          {filterType === 'custom' && (
            <>
              <div className="flex flex-col gap-1 w-full sm:w-40 animate-fade-in-down">
                <label className="text-[10px] font-bold text-emerald-800/60 uppercase">ตั้งแต่วันที่</label>
                <DatePicker
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  className="px-3.5 py-2 bg-white border border-emerald-150 rounded-xl font-bold text-xs text-emerald-850 focus:ring-4 focus:ring-emerald-50 outline-none shadow-sm cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-40 animate-fade-in-down">
                <label className="text-[10px] font-bold text-emerald-800/60 uppercase">ถึงวันที่</label>
                <DatePicker
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  className="px-3.5 py-2 bg-white border border-emerald-150 rounded-xl font-bold text-xs text-emerald-850 focus:ring-4 focus:ring-emerald-50 outline-none shadow-sm cursor-pointer"
                />
              </div>
            </>
          )}

          {/* Quick Clear Filter / Reset Button */}
          <button
            onClick={() => {
              setFilterType('month');
              setCustomStartDate('');
              setCustomEndDate('');
              const activeFY = fiscalYears.find(fy => fy.is_active);
              if (activeFY) setSelectedFiscalYear(activeFY.id);
            }}
            className="flex items-center justify-center p-2 rounded-xl text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-100 bg-white mt-auto cursor-pointer transition-colors shadow-sm self-stretch sm:self-auto shrink-0"
            title="ล้างตัวกรองทั้งหมด"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-24 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center gap-4 text-center shadow-inner">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
          <span className="font-bold text-emerald-800 animate-pulse text-sm">กำลังคำนวณและประมวลผลสถิติคลังเวชภัณฑ์จริง...</span>
        </div>
      ) : (
        <>
          {/* ================= SECTION 1: KEY STATS CARDS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
            
            {/* Card 1: Total Stock Value (Premium Emerald Card) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-6 rounded-3xl shadow-xl shadow-emerald-900/10 border border-emerald-700/30 transform hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-emerald-300 font-extrabold uppercase tracking-wider block">มูลค่าคลังเวชภัณฑ์คงเหลือรวม</span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight mt-2 block font-sans">
                    ฿{stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center shadow-inner shrink-0">
                  <Coins size={20} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-700/50 flex justify-between items-center text-xs text-emerald-200">
                <span className="font-semibold">ยอดคงคลังรวม</span>
                <span className="font-black text-white">{stats.totalInHandQty.toLocaleString()} ชิ้น</span>
              </div>
            </div>

            {/* Card 2: Total Active Items & Lots */}
            <div className="bg-white hover:bg-emerald-50/10 p-6 rounded-3xl shadow-sm hover:shadow-md border border-emerald-100/50 transform hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-emerald-800/60 font-extrabold uppercase tracking-wider block">รายการเวชภัณฑ์ & ล็อตคงคลัง</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2 block">
                    {stats.totalActiveProducts} <span className="text-xs text-emerald-600 font-medium">รายการ</span>
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm shrink-0">
                  <Package size={20} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-50 flex justify-between items-center text-xs text-emerald-800/60">
                <span className="font-semibold">ล็อตเวชภัณฑ์ที่ยังไม่หมดอายุ</span>
                <span className="font-black text-emerald-950">{stats.totalActiveLots} ล็อต</span>
              </div>
            </div>

            {/* Card 3: Active Borrowings (ยืมค้างส่งคืน) */}
            <div className="bg-white hover:bg-amber-50/10 p-6 rounded-3xl shadow-sm hover:shadow-md border border-emerald-100/50 transform hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-amber-800/70 font-extrabold uppercase tracking-wider block">รายการยืมค้างส่งคืน (Borrows)</span>
                  <span className={`text-2xl sm:text-3xl font-black mt-2 block ${stats.activeBorrowings > 0 ? 'text-amber-600 animate-pulse' : 'text-emerald-800'}`}>
                    {stats.activeBorrowings} <span className="text-xs text-amber-600 font-medium">รายการ</span>
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${stats.activeBorrowings > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <ArrowUpFromLine size={20} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-50 flex justify-between items-center text-xs">
                <span className="text-emerald-800/60 font-semibold">ระบบยืม-คืนเวชภัณฑ์</span>
                <Link to="/borrow" className="text-emerald-600 hover:text-emerald-700 font-black flex items-center gap-0.5">
                  จัดการยืม-คืน <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            {/* Card 4: Pending Requisitions (ใบเบิกค้างจัดการ) */}
            <div className="bg-white hover:bg-blue-50/10 p-6 rounded-3xl shadow-sm hover:shadow-md border border-emerald-100/50 transform hover:-translate-y-1 transition-all duration-300 group flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] text-blue-800/70 font-extrabold uppercase tracking-wider block">ใบเบิกที่รอจัดจ่ายเวชภัณฑ์</span>
                  <span className={`text-2xl sm:text-3xl font-black mt-2 block ${stats.pendingRequisitions > 0 ? 'text-blue-600' : 'text-emerald-800'}`}>
                    {stats.pendingRequisitions} <span className="text-xs text-blue-600 font-medium">เอกสาร</span>
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${stats.pendingRequisitions > 0 ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <FileText size={20} />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-50 flex justify-between items-center text-xs">
                <span className="text-emerald-800/60 font-semibold">ขออนุมัติเบิกใหม่</span>
                <Link to="/requisition/new" className="text-blue-600 hover:text-blue-700 font-black flex items-center gap-0.5">
                  ทำใบเบิกเวชภัณฑ์ <ArrowRight size={12} />
                </Link>
              </div>
            </div>

          </div>

          {/* ================= SECTION 2: PHARMACY MOVEMENT & ACTIVITY SUMMARY ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up">
            
            {/* Sales/Movement Activity this Month */}
            <div className="lg:col-span-3 glass p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-emerald-800 font-black mb-5 border-b border-emerald-100/80 pb-2.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  สถิติกิจกรรมงานคลังเวชภัณฑ์รอบเดือนนี้ (Pharmacy Monthly Activities)
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  
                  {/* Receive Monthly */}
                  <div className="bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1">
                    <span className="text-2xl font-black text-emerald-700 block">
                      {stats.recentReceives}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mt-1 block">ครั้ง</span>
                    <span className="text-xs text-emerald-950 font-extrabold mt-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> รับเวชภัณฑ์เข้า
                    </span>
                  </div>

                  {/* Dispense Monthly */}
                  <div className="bg-blue-50/40 hover:bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1">
                    <span className="text-2xl font-black text-blue-600 block">
                      {stats.recentDispenses}
                    </span>
                    <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mt-1 block">ครั้ง</span>
                    <span className="text-xs text-blue-900/80 font-extrabold mt-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> ตัดจ่ายเวชภัณฑ์ออก
                    </span>
                  </div>

                  {/* Disposal Monthly */}
                  <div className="bg-red-50/40 hover:bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1">
                    <span className="text-2xl font-black text-red-600 block">
                      {stats.recentDisposals}
                    </span>
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 block">รายการ</span>
                    <span className="text-xs text-red-900/80 font-extrabold mt-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> ตัดจำหน่าย/ชำรุด
                    </span>
                  </div>

                  {/* Critical Alerts */}
                  <div className="bg-rose-50/40 hover:bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1">
                    <span className="text-2xl font-black text-rose-600 block">
                      {stats.criticalAlerts}
                    </span>
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1 block">ล็อตด่วน</span>
                    <span className="text-xs text-rose-900/80 font-extrabold mt-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span> แจ้งเตือนคลังวิกฤต
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* Availability Doughnut Widget */}
            <div className="glass p-6 rounded-3xl flex flex-col justify-between">
              <h3 className="text-sm uppercase tracking-wider text-emerald-800 font-black mb-5 border-b border-emerald-100/80 pb-2.5">
                ความพร้อมจ่าย (Availability)
              </h3>
              
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-emerald-800/50 font-bold uppercase tracking-wider block">อัตราพร้อมเบิกจ่าย</span>
                  <span className="text-2xl font-black text-emerald-950 block leading-none">{activePercentage}%</span>
                  <span className="text-[9px] text-emerald-600 font-semibold block">เป้าหมาย &gt; 90% ของรายการคลัง</span>
                </div>

                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="30" stroke="#f0fdf4" strokeWidth="6" fill="transparent" />
                    <circle 
                      cx="40" 
                      cy="40" 
                      r="30" 
                      stroke="#059669" 
                      strokeWidth="6" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 30}
                      strokeDashoffset={2 * Math.PI * 30 - (activePercentage / 100) * 2 * Math.PI * 30}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute text-[10px] font-black text-emerald-950">Active</div>
                </div>
              </div>
              
              {/* Fulfillment Rate */}
              <div className="mt-4 pt-4 border-t border-emerald-100/50 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-emerald-800/50 font-bold uppercase tracking-wider block">อัตราการจ่ายยาตามใบเบิก (Fulfillment)</span>
                  <span className="text-xl font-black text-blue-950 block leading-none">{stats.fulfillmentRate}%</span>
                  <span className="text-[9px] text-blue-600 font-semibold block">สถิติจากใบเบิกที่เสร็จสิ้น</span>
                </div>

                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" stroke="#eff6ff" strokeWidth="5" fill="transparent" />
                    <circle 
                      cx="28" 
                      cy="28" 
                      r="24" 
                      stroke="#2563eb" 
                      strokeWidth="5" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 - (stats.fulfillmentRate / 100) * 2 * Math.PI * 24}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute text-[8px] font-black text-blue-950">Fulfilled</div>
                </div>
              </div>
            </div>

          </div>

          {/* ================= SECTION 3: SPECIAL SUPPLIES SPOTLIGHT (Schema Column Highlights) ================= */}
          <div className="glass overflow-hidden rounded-3xl animate-fade-in-up border border-emerald-100">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 px-6 py-3.5 text-white flex justify-between items-center">
              <h3 className="text-sm font-black tracking-wide uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                จุดเน้นการกำกับดูแลเวชภัณฑ์กลุ่มควบคุมเฉพาะ (Special Medical Supplies Spotlight)
              </h3>
              <span className="text-[9px] bg-emerald-700/50 px-2 py-0.5 rounded font-bold border border-emerald-600/30 uppercase tracking-widest text-emerald-300">
                กฎระเบียบFEFOและมาตรฐานคลัง
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-gradient-to-b from-white to-emerald-50/10">
              
              {/* Category 1: High Alert */}
              <div className="bg-amber-50/30 hover:bg-amber-50 border border-amber-200/50 hover:border-amber-300 p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex gap-4">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-amber-700 font-extrabold uppercase tracking-wider block">High Alert Medical Supplies</span>
                  <span className="text-lg font-black text-gray-900 block">เวชภัณฑ์เฝ้าระวังความปลอดภัยสูง</span>
                  <p className="text-xs text-gray-500 font-medium">เวชภัณฑ์ที่ต้องการความตระหนักระดับสูงสุดในการควบคุมคลัง การเบิก และล็อตวันหมดอายุ</p>
                  <div className="pt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      มีทั้งหมด {stats.highAlertCount} รายการ
                    </span>
                  </div>
                </div>
              </div>

              {/* Category 2: Psycho/Narco */}
              <div className="bg-rose-50/30 hover:bg-rose-50 border border-rose-200/50 hover:border-rose-300 p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex gap-4">
                <div className="w-12 h-12 bg-rose-500/10 text-rose-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldAlert size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-700 font-extrabold uppercase tracking-wider block">Psychotropic & Narcotic Drugs</span>
                  <span className="text-lg font-black text-gray-900 block">วัตถุออกฤทธิ์ / ยาเสพติดให้โทษ</span>
                  <p className="text-xs text-gray-500 font-medium">เวชภัณฑ์กลุ่มควบคุมเข้มงวดทางกฎหมาย ต้องบันทึกจำนวนสต๊อกและรายงานผู้สั่งจ่ายละเอียดถี่ถ้วน</p>
                  <div className="pt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      มีทั้งหมด {stats.psychoNarcoCount} รายการ
                    </span>
                  </div>
                </div>
              </div>

              {/* Category 3: Cold Storage */}
              <div className="bg-sky-50/30 hover:bg-sky-50 border border-sky-200/50 hover:border-sky-300 p-5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 flex gap-4">
                <div className="w-12 h-12 bg-sky-500/10 text-sky-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                  <ThermometerSnowflake size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-sky-700 font-extrabold uppercase tracking-wider block">Cold Storage Control (2-8°C)</span>
                  <span className="text-lg font-black text-gray-900 block">เวชภัณฑ์ควบคุมอุณหภูมิเย็น</span>
                  <p className="text-xs text-gray-500 font-medium">เวชภัณฑ์ประเภทวัคซีน ชีววัตถุ หรือยาควบคุมที่ห้ามเก็บในอุณหภูมิห้อง ต้องติดตามสต๊อกในตู้เย็นเฉพาะ</p>
                  <div className="pt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                      มีทั้งหมด {stats.coldStorageCount} รายการ
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ================= SECTION: EXPIRY STATUS SUMMARY ================= */}
          <div className="glass p-6 rounded-3xl animate-fade-in-up space-y-5 border border-emerald-100">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-emerald-150 pb-3">
              <div>
                <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-emerald-600 animate-pulse" />
                  สรุปความเสี่ยงยาหมดอายุ (Expiry Status Summary)
                </h3>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  ติดตามภาพรวมความเสี่ยงเวชภัณฑ์หมดอายุล่วงหน้า {expiryStats.warningMonths} เดือน ทั้งในคลังและจุดจ่าย
                </p>
              </div>
              <Link
                to="/expiry-tracking"
                className="text-xs font-black text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-full border border-emerald-150 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                ดูตารางและจัดการข้อมูลละเอียด <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              {/* KPI Cards on the Left (4 cols) */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                {/* Card 1: All Items */}
                <Link 
                  to="/expiry-tracking"
                  className="bg-white hover:bg-emerald-50/10 rounded-2xl p-4 border-t-4 border-gray-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start text-gray-400">
                    <span className="text-[11px] font-black uppercase tracking-wider">ยาทั้งหมด</span>
                    <Pill size={16} />
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-gray-900">{expiryStats.total}</span>
                    <span className="text-[10px] text-gray-500 font-bold block mt-0.5">รายการยาในระบบ</span>
                  </div>
                </Link>

                {/* Card 2: Expired */}
                <Link 
                  to="/expiry-tracking"
                  state={{ filter: 'EXPIRED' }}
                  className="bg-white hover:bg-rose-50/10 rounded-2xl p-4 border-t-4 border-red-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start text-red-500">
                    <span className="text-[11px] font-black uppercase tracking-wider">หมดอายุแล้ว</span>
                    <ShieldAlert size={16} />
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-red-600">{expiryStats.expired}</span>
                    <span className="text-[10px] text-red-500 font-bold block mt-0.5">ต้องจัดการทำลาย/บริจาค</span>
                  </div>
                </Link>

                {/* Card 3: Near Expiry */}
                <Link 
                  to="/expiry-tracking"
                  state={{ filter: 'WARNING' }}
                  className="bg-white hover:bg-amber-50/10 rounded-2xl p-4 border-t-4 border-orange-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start text-orange-500">
                    <span className="text-[11px] font-black uppercase tracking-wider">ใกล้หมดอายุ</span>
                    <Clock size={16} />
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-orange-600">{expiryStats.warning}</span>
                    <span className="text-[10px] text-orange-500 font-bold block mt-0.5">หมดอายุใน {expiryStats.warningMonths * 30} วัน</span>
                  </div>
                </Link>

                {/* Card 4: Safe */}
                <Link 
                  to="/expiry-tracking"
                  state={{ filter: 'SAFE' }}
                  className="bg-white hover:bg-emerald-50/10 rounded-2xl p-4 border-t-4 border-emerald-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start text-emerald-500">
                    <span className="text-[11px] font-black uppercase tracking-wider">ปลอดภัย</span>
                    <CheckCircle size={16} />
                  </div>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-emerald-600">{expiryStats.safe}</span>
                    <span className="text-[10px] text-emerald-500 font-bold block mt-0.5">ยาที่มีสภาพพร้อมใช้</span>
                  </div>
                </Link>
              </div>

              {/* Donut Chart 1: สถานะยา (4 cols) */}
              <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-emerald-100/30 flex flex-col justify-between min-h-[180px]">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-gray-900 text-xs">สถานะยา</span>
                </div>
                
                <div className="flex items-center justify-center h-28 relative my-1">
                  {expiryStats.total === 0 ? (
                    <div className="text-gray-400 text-xs font-semibold">ไม่มีข้อมูล</div>
                  ) : (
                    <>
                      <svg className="w-24 h-24 transform -rotate-90">
                        {statusSegments.map((seg, idx) => (
                          <circle
                            key={idx}
                            cx="48"
                            cy="48"
                            r="34"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="9"
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            className="transition-all duration-300 hover:stroke-[11px] cursor-pointer"
                          />
                        ))}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-gray-900">{expiryStats.total}</span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-3 text-[10px] font-bold mt-1 flex-wrap text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-emerald-500 inline-block"></span> ปลอดภัย ({expiryStats.safe})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-rose-500 inline-block"></span> หมดอายุแล้ว ({expiryStats.expired})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-amber-500 inline-block"></span> ใกล้หมดอายุ ({expiryStats.warning})
                  </span>
                </div>
              </div>

              {/* Donut Chart 2: จำนวนยาแยกตามจุดจัดเก็บ (4 cols) */}
              <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-emerald-100/30 flex flex-col justify-between min-h-[180px]">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-gray-900 text-xs">จำนวนยาแยกตามจุดจัดเก็บ</span>
                </div>

                <div className="flex items-center justify-center h-28 relative my-1">
                  {expiryStats.total === 0 ? (
                    <div className="text-gray-400 text-xs font-semibold">ไม่มีข้อมูล</div>
                  ) : (
                    <>
                      <svg className="w-24 h-24 transform -rotate-90">
                        {locationSegments.map((seg, idx) => (
                          <circle
                            key={idx}
                            cx="48"
                            cy="48"
                            r="34"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="9"
                            strokeDasharray={seg.strokeDasharray}
                            strokeDashoffset={seg.strokeDashoffset}
                            className="transition-all duration-300 hover:stroke-[11px] cursor-pointer"
                          />
                        ))}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-gray-900">{expiryStats.total}</span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-4 text-[10px] font-bold mt-1 flex-wrap text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-fuchsia-500 inline-block"></span> ชั้นจุดจ่าย ({expiryStats.manualCount})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-blue-500 inline-block"></span> สต๊อก ({expiryStats.systemCount})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECTION 4: EXPIRY HEATMAP ================= */}
          <div className="glass p-6 rounded-3xl animate-fade-in-up space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-emerald-100/80 pb-3">
              <div>
                <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-emerald-600 animate-pulse" />
                  ปฏิทินความเสี่ยงเวชภัณฑ์หมดอายุใน 6 เดือนถัดไป (Expiry Heatmap Dashboard)
                </h3>
                <p className="text-xs text-emerald-700/80 font-medium">ภาพรวมการติดตามล็อตคลังเวชภัณฑ์ใกล้หมดอายุ แยกตามเดือนเพื่อให้งานบริหารคลังจัดแผนการหมุนเวียนได้ล่วงหน้า</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 shrink-0">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></span> ปลอดภัย</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></span> เตือน (31-90 วัน)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-200 animate-pulse"></span> วิกฤต (≤30 วัน)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {expiryHeatmap.map((month, idx) => {
                const count = month.items.length;
                let bgClass = 'bg-gray-50/50 border-gray-100 hover:bg-gray-50';
                let badgeClass = 'bg-gray-100 text-gray-400 border-gray-200';
                
                if (count > 0) {
                  if (idx === 0) {
                    bgClass = 'bg-rose-50/70 border-rose-200 hover:bg-rose-50 hover:shadow-rose-100/50 hover:shadow-md';
                    badgeClass = 'bg-rose-500 text-white shadow-sm shadow-rose-200 border-rose-400';
                  } else if (idx <= 2) {
                    bgClass = 'bg-amber-50/70 border-amber-200 hover:bg-amber-50 hover:shadow-amber-100/50 hover:shadow-md';
                    badgeClass = 'bg-amber-500 text-white shadow-sm shadow-amber-200 border-amber-400';
                  } else {
                    bgClass = 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50 hover:shadow-emerald-100/50 hover:shadow-md';
                    badgeClass = 'bg-emerald-600 text-white shadow-sm shadow-emerald-200 border-emerald-500';
                  }
                }

                return (
                  <div 
                    key={month.key}
                    className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 ${bgClass}`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{month.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border tracking-wider ${badgeClass}`}>
                          {count} ล็อต
                        </span>
                      </div>

                      {count === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-emerald-600">
                          <CheckCircle className="w-8 h-8 text-emerald-400/80 mb-2" />
                          <span className="text-[10px] font-bold text-emerald-600/80 tracking-wider">ปลอดความเสี่ยง</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5 overflow-y-auto max-h-28 pr-0.5 scrollbar-thin">
                          {month.items.map((item: any, itemIdx: number) => (
                            <div 
                              key={itemIdx} 
                              className="bg-white/80 border border-black/5 hover:border-black/10 p-1.5 rounded-lg shadow-sm flex flex-col justify-between text-left group transition-all"
                            >
                              <span className="text-[11px] font-black text-gray-950 truncate" title={item.product_name}>
                                {item.product_name}
                              </span>
                              <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-gray-500 font-sans">
                                <span className="font-mono bg-gray-100 px-1 rounded text-[8px]">Lot: {item.lot_number}</span>
                                <span className={idx === 0 ? 'text-rose-600 font-extrabold' : 'text-gray-500'}>
                                  {item.current_qty} ชิ้น
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= SECTION 5: RECENT TRANSACTIONS TABLES (Replaces hardcoded dept status) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
            
            {/* Table 1: Recent Requisitions */}
            <div className="glass p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4 border-b border-emerald-100 pb-2">
                  <h3 className="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-600" />
                    ใบขอเบิกเวชภัณฑ์ล่าสุด (Recent Requisitions)
                  </h3>
                  <Link to="/requisition/new" className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5">
                    ขอเบิกใหม่ <ArrowRight size={10} />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-50/50 text-emerald-800 font-extrabold">
                        <th className="px-3 py-2 border-b border-emerald-100">วันที่</th>
                        <th className="px-3 py-2 border-b border-emerald-100">เลขที่ใบเบิก</th>
                        <th className="px-3 py-2 border-b border-emerald-100">ผู้ขอเบิก</th>
                        <th className="px-3 py-2 border-b border-emerald-100">ผู้อนุมัติจ่าย</th>
                        <th className="px-3 py-2 border-b border-emerald-100 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {recentRequisitions.length > 0 ? (
                        recentRequisitions.map((req) => (
                          <tr key={req.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-3 py-2 text-gray-500 font-semibold">{formatDate(req.doc_date)}</td>
                            <td className="px-3 py-2 font-mono font-bold text-gray-900">
                              <Link to={`/requisition/print/${req.id}`} className="hover:underline text-emerald-700">
                                {req.doc_no || 'DRAFT'}
                              </Link>
                            </td>
                            <td className="px-3 py-2 font-bold text-gray-800">{req.requester?.full_name || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{req.approver?.full_name || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              {(() => {
                                switch (req.status) {
                                  case 'PENDING':
                                    return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold text-[10px] animate-pulse">รออนุมัติ</span>;
                                  case 'COMPLETED':
                                    return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md font-bold text-[10px]">ได้รับของแล้ว</span>;
                                  case 'REJECTED':
                                    return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-bold text-[10px]">ไม่อนุมัติ/ยกเลิก</span>;
                                  case 'DRAFT':
                                  default:
                                    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-bold text-[10px]">ฉบับร่าง (DRAFT)</span>;
                                }
                              })()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-400 font-semibold">ไม่พบข้อมูลใบขอเบิกเวชภัณฑ์ล่าสุด</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Table 2: Active Borrowings */}
            <div className="glass p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4 border-b border-emerald-100 pb-2">
                  <h3 className="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-600" />
                    รายการเวชภัณฑ์ค้างยืมล่าสุด (Active Borrowings)
                  </h3>
                  <Link to="/borrow" className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5">
                    ดูคลังยืม-คืน <ArrowRight size={10} />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-50/50 text-emerald-800 font-extrabold">
                        <th className="px-3 py-2 border-b border-emerald-100">วันที่ยืม</th>
                        <th className="px-3 py-2 border-b border-emerald-100">ผู้ยืม</th>
                        <th className="px-3 py-2 border-b border-emerald-100">เวชภัณฑ์</th>
                        <th className="px-3 py-2 border-b border-emerald-100 text-right">จำนวนค้างคืน</th>
                        <th className="px-3 py-2 border-b border-emerald-100 text-center">คืน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {recentBorrowings.length > 0 ? (
                        recentBorrowings.map((borrow) => {
                          const unreturned = borrow.borrowed_qty - borrow.returned_qty;
                          return (
                            <tr key={borrow.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-3 py-2 text-gray-500 font-semibold">{formatDate(borrow.created_at)}</td>
                              <td className="px-3 py-2 font-bold text-gray-800">{borrow.officers?.full_name || '-'}</td>
                              <td className="px-3 py-2 font-bold text-emerald-800 truncate max-w-[150px]" title={borrow.products?.generic_name}>
                                {borrow.products?.generic_name}
                              </td>
                              <td className="px-3 py-2 text-right font-extrabold text-amber-600">{unreturned} ชิ้น</td>
                              <td className="px-3 py-2 text-center">
                                <Link 
                                  to={`/borrow/return/${borrow.id}`} 
                                  className="inline-flex items-center justify-center p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded transition-colors"
                                  title="ทำเรื่องคืนเวชภัณฑ์"
                                >
                                  <RotateCcw size={12} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-400 font-semibold">ไม่มีเวชภัณฑ์ค้างส่งคืนในขณะนี้</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          {/* ================= SECTION 6: ANALYTICAL DETAILS GRID ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in-up">
            
            {/* Low Stock and Product Details Card */}
            <div className="lg:col-span-2 glass p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-emerald-800 font-black mb-5 border-b border-emerald-100 pb-2">
                  สรุปความเสี่ยงและจุดสั่งซื้อ (Stock Reorder Alerts)
                </h3>
                
                <div className="space-y-3.5 text-sm my-4">
                  <div className="flex justify-between border-b border-emerald-50 pb-2">
                    <span className="text-red-600 font-extrabold flex items-center gap-1.5" title="เวชภัณฑ์ที่มีจำนวนรวมต่ำกว่าจุดสั่งซื้อวิกฤต">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" /> สต๊อกใกล้หมด (ต่ำกว่าจุดสั่งซื้อ)
                    </span>
                    <span className="font-bold text-red-700">{lowStockAlerts.length} รายการ</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-50 pb-2 text-emerald-950/70 font-semibold">
                    <span className="flex items-center gap-1.5" title="เวชภัณฑ์คงเหลือแต่ไม่มีประวัติจ่ายออกใน 90 วันย้อนหลัง">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> ค้างคลังไร้เคลื่อนไหว (Dead Stock)
                    </span>
                    <span className="font-bold text-amber-600">{deadStock.length} รายการ</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-50 pb-2 text-emerald-950/70 font-semibold">
                    <span>รายการเวชภัณฑ์ควบคุมใช้งาน</span>
                    <span className="font-bold">{stats.totalActiveProducts}</span>
                  </div>
                  <div className="flex justify-between text-emerald-950/70 font-semibold">
                    <span>แจ้งเตือนล็อตคลังวิกฤตทั้งหมด</span>
                    <span className="font-bold text-red-600">{stats.criticalAlerts}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Requested / Moving Items */}
            <div className="lg:col-span-3 glass p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-5 border-b border-emerald-100 pb-2">
                  <h3 className="text-sm uppercase tracking-wider text-emerald-800 font-black flex items-center gap-1">
                    <Award className="w-4 h-4 text-emerald-600 animate-bounce" />
                    เวชภัณฑ์ที่มีการเบิกจ่ายสูงสุด (Top Requested)
                  </h3>
                  <span className="text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-emerald-700 font-bold uppercase tracking-wider">
                    เบิกจ่ายสูงสุด 30 วันที่ผ่านมา
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {topMoving.length > 0 ? (
                    topMoving.map((item, idx) => (
                      <div key={idx} className="border border-emerald-100/70 rounded-2xl p-3.5 text-center bg-gradient-to-b from-white to-emerald-50/20 hover:shadow-md transition-all group flex flex-col justify-between transform hover:-translate-y-1 duration-200">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                          {idx === 0 ? <Award size={22} className="text-amber-500" /> : <Package size={22} />}
                        </div>
                        <p className="text-xs font-black text-emerald-950 truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-emerald-700 font-extrabold mt-1">{item.qty.toLocaleString()} หน่วย</p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-6 text-emerald-800/40 font-bold text-xs">
                      ยังไม่มีข้อมูลประวัติจ่ายออกในรอบ 30 วัน
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ================= SECTION 7: QUICK ACTIONS MENU ================= */}
          <div className="pt-2 animate-fade-in-up">
            <h2 className="text-sm uppercase tracking-wider text-emerald-800 font-black mb-5 border-b border-emerald-100 pb-2">
              ทางลัดการทำธุรกรรมคลังด่วน (Quick Actions Dashboard)
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              
              {/* Action 1: Receive */}
              <Link 
                to="/receive" 
                className="group bg-white p-4 rounded-2xl border border-emerald-100 hover:border-emerald-400 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <ArrowDownToLine size={20} />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-950 text-xs block">รับเวชภัณฑ์เข้าคลัง</span>
                  <span className="text-[9px] text-emerald-800/50 font-bold uppercase mt-0.5 block">Record Receive</span>
                </div>
              </Link>

              {/* Action 2: Dispense */}
              <Link 
                to="/dispense" 
                className="group bg-white p-4 rounded-2xl border border-emerald-100 hover:border-emerald-400 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <ArrowUpFromLine size={20} />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-950 text-xs block">จ่ายเวชภัณฑ์</span>
                  <span className="text-[9px] text-emerald-800/50 font-bold uppercase mt-0.5 block">Dispense Stock</span>
                </div>
              </Link>

              {/* Action 3: Borrow/Return */}
              <Link 
                to="/borrow" 
                className="group bg-white p-4 rounded-2xl border border-emerald-100 hover:border-emerald-400 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Layers size={20} />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-950 text-xs block">ยืม-คืนเวชภัณฑ์</span>
                  <span className="text-[9px] text-emerald-800/50 font-bold uppercase mt-0.5 block">Borrow / Return</span>
                </div>
              </Link>

              {/* Action 4: Stock Card */}
              <Link 
                to="/reports/stock-card" 
                className="group bg-white p-4 rounded-2xl border border-emerald-100 hover:border-emerald-400 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Boxes size={20} />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-950 text-xs block">บัญชีคุม Stock Card</span>
                  <span className="text-[9px] text-emerald-800/50 font-bold uppercase mt-0.5 block">Stock Card Report</span>
                </div>
              </Link>

              {/* Action 5: Adjust */}
              <Link 
                to="/stock/adjust" 
                className="group bg-white p-4 rounded-2xl border border-emerald-100 hover:border-emerald-400 hover:shadow-lg transition-all text-center flex flex-col items-center justify-center gap-3 col-span-2 md:col-span-1"
              >
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <span className="font-extrabold text-emerald-950 text-xs block">ปรับยอดสต๊อกชำรุด</span>
                  <span className="text-[9px] text-emerald-800/50 font-bold uppercase mt-0.5 block">Adjust Balance</span>
                </div>
              </Link>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
