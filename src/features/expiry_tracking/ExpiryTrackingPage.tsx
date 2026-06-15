import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, AlertTriangle, Clock, Search, Filter, Plus, Calendar, X, CheckCircle, Printer, FileSpreadsheet, Pill, Trash, Edit2 } from 'lucide-react';
import AddManualExpiryModal from './AddManualExpiryModal';
import { formatDate } from '@/utils/dateUtils';
import { useWarehouses } from '@/hooks/useWarehouses';
import * as XLSX from 'xlsx';

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
  status?: string;
  product_id?: string;
  warehouse_id?: string;
  lot_id?: string;
  unit_price?: number;
  pack_size?: number;
}

interface DisposalItem {
  id: string;
  qty: number;
  remark: string;
  created_at: string;
  product_name: string;
  drug_code?: string;
  unit_price: number;
  lot_number: string;
  warehouse_name: string;
  source: 'SYSTEM' | 'MANUAL';
}

interface DeadStockItem {
  product_id: string;
  generic_name: string;
  drug_code?: string;
  unit_name: string;
  qty: number;
  unit_price: number;
  total_value: number;
  location: string;
  last_movement_date?: string;
}

export default function ExpiryTrackingPage() {
  const { warehouses } = useWarehouses();
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [warningMonths, setWarningMonths] = useState(6);

  // Tabs
  const [activeTab, setActiveTab] = useState<'EXPIRY' | 'DISPOSAL' | 'DEAD_STOCK'>('EXPIRY');

  // Filters for Expiry Tab
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'SYSTEM' | 'MANUAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'WARNING_3' | 'WARNING_6' | 'WARNING_12' | 'SAFE' | 'DESTROYED'>('ALL');

  // Disposal Log state
  const [disposalItems, setDisposalItems] = useState<DisposalItem[]>([]);
  const [isDisposalLoading, setIsDisposalLoading] = useState(false);
  const [disposalSourceFilter, setDisposalSourceFilter] = useState<'ALL' | 'SYSTEM' | 'MANUAL'>('ALL');

  // Dead Stock state
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([]);
  const [deadStockMonths, setDeadStockMonths] = useState(3);
  const [isDeadStockLoading, setIsDeadStockLoading] = useState(false);

  // Destruction state
  const [destroyingItem, setDestroyingItem] = useState<ExpiryItem | null>(null);
  const [destroyQty, setDestroyQty] = useState<number>(0);
  const [destroyReason, setDestroyReason] = useState<string>('EXPIRED');
  const [isDestroySubmitting, setIsDestroySubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpiryItem | null>(null);

  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as any).filter) {
      setStatusFilter((location.state as any).filter);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: orgData } = await supabase.from('organization_info').select('expiry_warning_months').limit(1);
      const months = orgData?.[0]?.expiry_warning_months ?? 6;
      setWarningMonths(months);

      const { data: systemStock, error: sysError } = await supabase
        .from('stock_balances')
        .select(`
          id,
          current_qty,
          warehouse_id,
          products ( id, generic_name, trade_name, drug_code, pack_size, unit_id, master_units(unit_name), unit_price ),
          lots!inner ( id, lot_number, expiry_date, unit_price )
        `)
        .gt('current_qty', 0)
        .not('lots.expiry_date', 'is', null);

      if (sysError) throw sysError;

      const { data: manualStock, error: manError } = await supabase
        .from('manual_expirations')
        .select(`
          id,
          product_id,
          lot_number,
          expiry_date,
          qty,
          warehouse_id,
          manufacturer,
          remark,
          status,
          products ( id, generic_name, trade_name, drug_code, pack_size, unit_id, master_units(unit_name), unit_price )
        `);

      if (manError) throw manError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const combined: ExpiryItem[] = [];

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
          days_remaining: diffDays,
          status: 'ACTIVE',
          product_id: item.products?.id,
          warehouse_id: item.warehouse_id,
          lot_id: item.lots?.id,
          unit_price: item.lots?.unit_price || item.products?.unit_price || 0,
          pack_size: item.products?.pack_size || 1
        });
      });

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
          remark: item.remark,
          status: item.status || 'ACTIVE',
          product_id: item.product_id || item.products?.id,
          warehouse_id: item.warehouse_id,
          unit_price: item.products?.unit_price || 0,
          pack_size: item.products?.pack_size || 1
        });
      });

      combined.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
      setItems(combined);
    } catch (err: any) {
      console.error('Error fetching expiry data:', err);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDisposals = async () => {
    setIsDisposalLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_movement_items')
        .select(`
          id,
          qty,
          remark,
          created_at,
          products ( generic_name, drug_code, unit_price ),
          lots ( lot_number, unit_price ),
          stock_movements!inner ( movement_type, from_warehouse_id, note )
        `)
        .eq('stock_movements.movement_type', 'DISPOSE')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((item: any) => {
        const qtyVal = Math.abs(item.qty || 0);
        const price = item.lots?.unit_price || item.products?.unit_price || 0;
        const warehouseName = warehouses.find(w => w.id === item.stock_movements?.from_warehouse_id)?.name || 'ไม่ระบุคลัง';

        return {
          id: item.id,
          qty: qtyVal,
          remark: item.remark || 'EXPIRED',
          created_at: item.created_at,
          product_name: item.products?.generic_name || 'Unknown',
          drug_code: item.products?.drug_code,
          unit_price: price,
          lot_number: item.lots?.lot_number || '-',
          warehouse_name: warehouseName,
          source: item.stock_movements?.note || 'SYSTEM'
        };
      });
      setDisposalItems(processed);
    } catch (err) {
      console.error('Error fetching disposals:', err);
    } finally {
      setIsDisposalLoading(false);
    }
  };

  const fetchDeadStock = async () => {
    setIsDeadStockLoading(true);
    try {
      const { data: balances, error: balError } = await supabase
        .from('stock_balances')
        .select(`
          current_qty,
          warehouse_id,
          product_id,
          products ( id, generic_name, drug_code, unit_price, master_units(unit_name) ),
          lots ( unit_price )
        `)
        .gt('current_qty', 0);

      if (balError) throw balError;

      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - deadStockMonths);

      const { data: movements, error: moveError } = await supabase
        .from('stock_movement_items')
        .select(`
          product_id,
          stock_movements!inner ( movement_type, created_at )
        `)
        .eq('stock_movements.movement_type', 'ISSUE')
        .gte('stock_movements.created_at', thresholdDate.toISOString());

      if (moveError) throw moveError;

      const activeProductIdsInPeriod = new Set(movements?.map((m: any) => m.product_id) || []);
      const deadStockMap = new Map<string, DeadStockItem>();

      balances?.forEach((b: any) => {
        const prodId = b.product_id;
        if (!prodId || activeProductIdsInPeriod.has(prodId)) return;

        const warehouseName = warehouses.find(w => w.id === b.warehouse_id)?.name || 'คลังหลัก';
        const price = b.lots?.unit_price || b.products?.unit_price || 0;
        const qty = b.current_qty || 0;
        const unitName = Array.isArray(b.products?.master_units) ? b.products?.master_units[0]?.unit_name : (b.products?.master_units?.unit_name || 'ชิ้น');

        const existing = deadStockMap.get(prodId);
        if (existing) {
          existing.qty += qty;
          existing.total_value += qty * price;
        } else {
          deadStockMap.set(prodId, {
            product_id: prodId,
            generic_name: b.products?.generic_name || 'Unknown',
            drug_code: b.products?.drug_code,
            unit_name: unitName,
            qty: qty,
            unit_price: price,
            total_value: qty * price,
            location: warehouseName
          });
        }
      });

      setDeadStockItems(Array.from(deadStockMap.values()).sort((a, b) => b.total_value - a.total_value));
    } catch (err) {
      console.error('Error fetching dead stock:', err);
    } finally {
      setIsDeadStockLoading(false);
    }
  };

  useEffect(() => {
    if (warehouses.length > 0) {
      fetchData();
    }
  }, [warehouses]);

  useEffect(() => {
    if (warehouses.length > 0) {
      if (activeTab === 'DISPOSAL') {
        fetchDisposals();
      } else if (activeTab === 'DEAD_STOCK') {
        fetchDeadStock();
      }
    }
  }, [activeTab, deadStockMonths, warehouses]);

  // Filtering Expiry Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (search) {
        const query = search.toLowerCase();
        const matchName = item.generic_name.toLowerCase().includes(query) || (item.trade_name?.toLowerCase().includes(query));
        const matchCode = item.drug_code?.toLowerCase().includes(query);
        const matchLot = item.lot_number?.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchLot) return false;
      }

      if (sourceFilter !== 'ALL' && item.source !== sourceFilter) return false;

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'DESTROYED') {
          return item.status === 'DESTROYED';
        }

        // Exclude DESTROYED items from other warning status filters
        if (item.status === 'DESTROYED') return false;

        if (statusFilter === 'EXPIRED' && item.days_remaining > 0) return false;
        if (statusFilter === 'WARNING_3' && (item.days_remaining <= 0 || item.days_remaining > 90)) return false;
        if (statusFilter === 'WARNING_6' && (item.days_remaining <= 0 || item.days_remaining > 180)) return false;
        if (statusFilter === 'WARNING_12' && (item.days_remaining < 270 || item.days_remaining > 360)) return false;
        if (statusFilter === 'SAFE' && item.days_remaining <= 180) return false;
      } else {
        // Exclude DESTROYED items from ALL active status list by default
        if (item.status === 'DESTROYED') return false;
      }

      return true;
    });
  }, [items, search, sourceFilter, statusFilter]);

  // Filtering Disposals
  const filteredDisposals = useMemo(() => {
    return disposalItems.filter(item => {
      if (disposalSourceFilter !== 'ALL' && item.source !== disposalSourceFilter) return false;
      return true;
    });
  }, [disposalItems, disposalSourceFilter]);

  const stats = useMemo(() => {
    let total = 0;
    let expired = 0;
    let warning3 = 0;
    let warning6 = 0;
    let watchlist = 0;
    let safe = 0;
    let systemCount = 0;
    let manualCount = 0;
    let destroyed = 0;

    items.forEach(item => {
      if (item.status === 'DESTROYED') {
        destroyed++;
        return; // Skip active stock status calculations for destroyed items
      }

      total++;

      if (item.days_remaining <= 0) {
        expired++;
      } else if (item.days_remaining <= 90) {
        warning3++;
      }

      if (item.days_remaining > 0 && item.days_remaining <= 180) {
        warning6++;
      }

      if (item.days_remaining >= 270 && item.days_remaining <= 360) {
        watchlist++;
      }

      if (item.days_remaining > 180) {
        safe++;
      }

      if (item.source === 'SYSTEM') {
        systemCount++;
      } else if (item.source === 'MANUAL') {
        manualCount++;
      }
    });

    return { total, expired, warning3, warning6, watchlist, safe, systemCount, manualCount, destroyed };
  }, [items]);

  const statusSegments = useMemo(() => {
    const total = stats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'SAFE', value: stats.safe, color: '#10b981', label: 'ปลอดภัย', filterVal: 'SAFE' },
      { key: 'WARNING_6', value: stats.warning6, color: '#f59e0b', label: 'ใกล้หมดอายุ', filterVal: 'WARNING_6' },
      { key: 'EXPIRED', value: stats.expired, color: '#f43f5e', label: 'หมดอายุแล้ว', filterVal: 'EXPIRED' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 38;
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [stats]);

  const locationSegments = useMemo(() => {
    const total = stats.total;
    if (total === 0) return [];

    const segmentsData = [
      { key: 'MANUAL', value: stats.manualCount, color: '#d946ef', label: 'ชั้นจุดจ่าย', filterVal: 'MANUAL' },
      { key: 'SYSTEM', value: stats.systemCount, color: '#3b82f6', label: 'สต๊อก', filterVal: 'SYSTEM' }
    ].filter(s => s.value > 0);

    const circumference = 2 * Math.PI * 38;
    let offset = 0;

    return segmentsData.map(s => {
      const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
      const strokeDashoffset = offset;
      offset -= (s.value / total) * circumference;
      return { ...s, strokeDasharray, strokeDashoffset };
    });
  }, [stats]);

  const handleExportExcel = () => {
    let data: any[] = [];
    let fileName = '';

    if (activeTab === 'EXPIRY') {
      fileName = `RKH_Expiry_Report_${new Date().toISOString().split('T')[0]}`;
      data = filteredItems.map(item => ({
        'เวชภัณฑ์': item.generic_name,
        'ชื่อการค้า': item.trade_name || '',
        'รหัสเวชภัณฑ์': item.drug_code || '',
        'แหล่งข้อมูล': item.source === 'SYSTEM' ? 'คลังเวชภัณฑ์ (In-Stock)' : 'ชั้นจุดจ่าย (Manual Tracking)',
        'สถานที่': item.location,
        'เลขล็อต': item.lot_number,
        'วันหมดอายุ': item.expiry_date,
        'วันคงเหลือ': item.days_remaining <= 0 ? `หมดอายุแล้ว ${Math.abs(item.days_remaining)} วัน` : `${item.days_remaining} วัน`,
        'จำนวนคงเหลือ': item.qty ?? 0,
        'หน่วยนับ': item.unit_name || '',
        'ผู้ผลิต': item.manufacturer || '',
        'หมายเหตุ': item.remark || ''
      }));
    } else if (activeTab === 'DISPOSAL') {
      fileName = `RKH_Disposal_Loss_Report_${new Date().toISOString().split('T')[0]}`;
      data = filteredDisposals.map(item => ({
        'วันที่ทำลาย': new Date(item.created_at).toLocaleDateString('th-TH'),
        'แหล่งข้อมูล': item.source === 'SYSTEM' ? 'คลังเวชภัณฑ์ (In-Stock)' : 'ชั้นจุดจ่าย (Manual Tracking)',
        'คลังสินค้า': item.warehouse_name,
        'เวชภัณฑ์': item.product_name,
        'รหัสเวชภัณฑ์': item.drug_code || '',
        'เลขล็อต': item.lot_number,
        'สาเหตุ': item.remark === 'EXPIRED' ? 'หมดอายุ' : item.remark === 'DONATED' ? 'บริจาค' : 'เสื่อมสภาพ',
        'จำนวนตัด': item.qty,
        'ราคาต่อหน่วย': item.unit_price,
        'มูลค่าความสูญเสีย': item.qty * item.unit_price
      }));
    } else if (activeTab === 'DEAD_STOCK') {
      fileName = `RKH_Dead_Stock_Report_${new Date().toISOString().split('T')[0]}`;
      data = deadStockItems.map(item => ({
        'รหัสเวชภัณฑ์': item.drug_code || '',
        'เวชภัณฑ์': item.generic_name,
        'สถานที่จัดเก็บล่าสุด': item.location,
        'จำนวนคงเหลือ': item.qty,
        'หน่วยนับ': item.unit_name,
        'ราคาต่อหน่วย': item.unit_price,
        'มูลค่าทุนจม': item.total_value
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'EXPIRY' ? 'Expiry_Report' : activeTab === 'DISPOSAL' ? 'Disposal_Report' : 'Dead_Stock_Report');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const getStatusDisplay = (days: number, itemStatus?: string) => {
    if (itemStatus === 'DESTROYED') {
      return {
        label: 'ทำลายแล้ว (Destroyed)',
        bg: 'bg-neutral-100 text-neutral-500 border-neutral-200',
        icon: <Trash size={16} className="text-neutral-400" />
      };
    }
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
    } else if (days <= 90) {
      return {
        label: `วิกฤต (เหลือ ${days} วัน)`,
        bg: 'bg-rose-50 text-rose-700 border-rose-150',
        icon: <AlertTriangle size={16} className="text-rose-500 animate-pulse" />
      };
    } else if (days <= 180) {
      return {
        label: `เตือน (เหลือ ${days} วัน)`,
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: <AlertTriangle size={16} className="text-orange-500" />
      };
    } else {
      return {
        label: `ปกติ (เหลือ ${days} วัน)`,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <Clock size={16} className="text-emerald-500" />
      };
    }
  };

  const openDestroyModal = (item: ExpiryItem) => {
    setDestroyingItem(item);
    setDestroyQty(item.qty || 0);
    setDestroyReason('EXPIRED');
  };

  const handleConfirmDestroy = async () => {
    if (!destroyingItem) return;
    if (destroyQty <= 0) {
      alert('กรุณาระบุจำนวนที่จะทำลายมากกว่า 0');
      return;
    }
    if (destroyingItem.qty !== null && destroyQty > destroyingItem.qty) {
      alert('จำนวนที่จะทำลายมากกว่าจำนวนคงเหลือในระบบ');
      return;
    }

    setIsDestroySubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');

      // 1. Create a stock movement header (DISPOSE)
      const { data: movement, error: moveError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'DISPOSE',
          from_warehouse_id: destroyingItem.warehouse_id || null,
          created_by: userId,
          created_by_position: null,
          note: destroyingItem.source
        })
        .select('id')
        .single();

      if (moveError) throw moveError;

      // Calculate unit price and pack size
      const unitPrice = destroyingItem.unit_price || 0;
      const packSize = destroyingItem.pack_size || 1;

      // Resolve lot_id if missing (e.g. for MANUAL source items)
      let lotId = destroyingItem.lot_id || null;
      if (!lotId && destroyingItem.product_id) {
        const { data: createdLotId, error: lotError } = await supabase.rpc('find_or_create_lot', {
          p_product_id: destroyingItem.product_id,
          p_lot_number: destroyingItem.lot_number || '-',
          p_expiry_date: destroyingItem.expiry_date || null,
          p_unit_price: unitPrice
        });
        if (lotError) throw lotError;
        lotId = createdLotId;
      }

      // 2. Insert transaction item into stock_movement_items
      const { error: itemError } = await supabase
        .from('stock_movement_items')
        .insert({
          movement_id: movement.id,
          product_id: destroyingItem.product_id,
          lot_id: lotId,
          qty: -Number(destroyQty),
          pack_size: packSize,
          unit_name: destroyingItem.unit_name || 'ชิ้น',
          remark: destroyReason,
          unit_price: unitPrice
        });

      if (itemError) throw itemError;

      // 3. For SYSTEM items, deduct from stock_balances using RPC
      if (destroyingItem.source === 'SYSTEM') {
        const { error: deductError } = await supabase.rpc('deduct_stock_balance', {
          p_product_id: destroyingItem.product_id,
          p_warehouse_id: destroyingItem.warehouse_id,
          p_lot_number: destroyingItem.lot_number,
          p_qty: Number(destroyQty),
          p_expiry_date: destroyingItem.expiry_date || null
        });

        if (deductError) throw deductError;

        // Create a manual_expirations record with Qty = 0 and status = 'DESTROYED'
        // so that it shows up as "Destroyed" and "0" in the tracking list
        const { error: manInsertError } = await supabase
          .from('manual_expirations')
          .insert({
            product_id: destroyingItem.product_id,
            lot_number: destroyingItem.lot_number,
            expiry_date: destroyingItem.expiry_date,
            qty: 0,
            warehouse_id: destroyingItem.warehouse_id,
            manufacturer: destroyingItem.manufacturer || null,
            remark: `ระบบทำลายยาคลัง: ${destroyReason}`,
            status: 'DESTROYED',
            created_by: userId
          });
          
        if (manInsertError) console.error('Error creating manual tracking placeholder:', manInsertError);
      } else {
        // For MANUAL items, update the manual_expirations table
        // We set status = 'DESTROYED' and qty = 0
        const realId = destroyingItem.id.replace('man_', '');
        const { error: manUpdateError } = await supabase
          .from('manual_expirations')
          .update({
            status: 'DESTROYED',
            qty: 0,
            remark: `ทำลายแล้ว: ${destroyReason}`
          })
          .eq('id', realId);

        if (manUpdateError) throw manUpdateError;
      }

      alert('ทำลายเวชภัณฑ์สำเร็จ ระบบได้สร้างเอกสารและหักออกจากสต๊อกเรียบร้อยแล้ว');
      setDestroyingItem(null);
      
      // Refresh data
      fetchData();
      if (activeTab === 'DISPOSAL') {
        fetchDisposals();
      }
    } catch (err: any) {
      console.error('Error destroying item:', err);
      alert('ทำลายยาไม่สำเร็จ: ' + err.message);
    } finally {
      setIsDestroySubmitting(false);
    }
  };

  const handleManualDelete = async (id: string) => {
    if (!confirm('ยืนยันลบรายการติดตามยานี้?')) return;
    const realId = id.replace('man_', '');
    try {
      const { error } = await supabase.from('manual_expirations').delete().eq('id', realId);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-red-650 to-orange-500 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden animate-fade-in-up print:hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30 shadow-inner">
              <Calendar size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1">รายงานอายุยาและการสูญเสีย</h1>
              <p className="text-red-100 font-medium text-sm">ตรวจสอบความเสี่ยงยาหมดอายุ ติดตามประวัติการทำลายยา/ความสูญเสีย และยอดทุนจมค้างคลัง (Dead Stock)</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-5 py-3 rounded-xl font-bold hover:bg-white/20 hover:scale-105 transition-all shadow-md cursor-pointer"
            >
              <Printer size={18} />
              พิมพ์รายงาน
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 hover:scale-105 transition-all shadow-md cursor-pointer"
            >
              <FileSpreadsheet size={18} />
              ส่งออก Excel
            </button>
            {activeTab === 'EXPIRY' && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 hover:scale-105 transition-all shadow-md cursor-pointer"
              >
                <Plus size={20} strokeWidth={3} />
                เพิ่มรายการยาที่ชั้นจุดจ่าย
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 print:hidden scroll-x-auto pb-px">
        <button
          onClick={() => setActiveTab('EXPIRY')}
          className={`px-6 py-3 text-sm font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'EXPIRY'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          ⏰ รายงานอายุยาหมดอายุ & เฝ้าระวัง
        </button>
        <button
          onClick={() => setActiveTab('DISPOSAL')}
          className={`px-6 py-3 text-sm font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'DISPOSAL'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          🗑️ รายงานการทำลายยา & มูลค่าความสูญเสีย
        </button>
        <button
          onClick={() => setActiveTab('DEAD_STOCK')}
          className={`px-6 py-3 text-sm font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'DEAD_STOCK'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📦 รายงานยาไม่มีการเคลื่อนไหว (Dead Stock)
        </button>
      </div>

      {/* TAB 1: EXPIRY TRACKING REPORT */}
      {activeTab === 'EXPIRY' && (
        <div className="space-y-6">
          {/* Expiry Dashboard Overview (Print Hidden) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 animate-fade-in-up print:hidden">
            {/* KPI Cards on the Left (6 cols) */}
            <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Card 1: All Items */}
              <div 
                onClick={() => { setStatusFilter('ALL'); setSourceFilter('ALL'); }}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'ALL' && sourceFilter === 'ALL' ? 'border-gray-950 ring-4 ring-gray-950/10 scale-[1.02] shadow-md' : 'border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start text-gray-400">
                  <span className="text-[11px] font-black uppercase tracking-wider">ยาทั้งหมด</span>
                  <Pill size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                  <span className="text-[10px] text-gray-500 font-bold block mt-0.5">รายการยาในระบบ</span>
                </div>
              </div>

              {/* Card 2: Expired */}
              <div 
                onClick={() => setStatusFilter('EXPIRED')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'EXPIRED' ? 'border-red-600 ring-4 ring-red-600/15 scale-[1.02] shadow-md' : 'border-red-500/85'
                }`}
              >
                <div className="flex justify-between items-start text-red-500">
                  <span className="text-[11px] font-black uppercase tracking-wider">หมดอายุแล้ว</span>
                  <ShieldAlert size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-red-600">{stats.expired}</span>
                  <span className="text-[10px] text-red-500 font-bold block mt-0.5">ต้องจัดการทำลาย</span>
                </div>
              </div>

              {/* Card 3: Near Expiry <= 3 Months */}
              <div 
                onClick={() => setStatusFilter('WARNING_3')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'WARNING_3' ? 'border-rose-500 ring-4 ring-rose-500/15 scale-[1.02] shadow-md' : 'border-rose-400/80'
                }`}
              >
                <div className="flex justify-between items-start text-rose-500">
                  <span className="text-[11px] font-black uppercase tracking-wider">วิกฤต (≤ 3ด.)</span>
                  <Clock size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-rose-600">{stats.warning3}</span>
                  <span className="text-[10px] text-rose-500 font-bold block mt-0.5">หมดอายุใน 90 วัน</span>
                </div>
              </div>

              {/* Card 4: Near Expiry <= 6 Months */}
              <div 
                onClick={() => setStatusFilter('WARNING_6')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'WARNING_6' ? 'border-orange-500 ring-4 ring-orange-500/15 scale-[1.02] shadow-md' : 'border-orange-400/80'
                }`}
              >
                <div className="flex justify-between items-start text-orange-500">
                  <span className="text-[11px] font-black uppercase tracking-wider">เตือน (≤ 6ด.)</span>
                  <AlertTriangle size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-orange-650">{stats.warning6}</span>
                  <span className="text-[10px] text-orange-500 font-bold block mt-0.5">หมดอายุใน 180 วัน</span>
                </div>
              </div>

              {/* Card 5: Watchlist 9-12 Months */}
              <div 
                onClick={() => setStatusFilter('WARNING_12')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'WARNING_12' ? 'border-yellow-500 ring-4 ring-yellow-500/15 scale-[1.02] shadow-md' : 'border-yellow-400/80'
                }`}
              >
                <div className="flex justify-between items-start text-yellow-600">
                  <span className="text-[11px] font-black uppercase tracking-wider">เฝ้าระวัง (9-12ด.)</span>
                  <Clock size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-yellow-600">{stats.watchlist}</span>
                  <span className="text-[10px] text-yellow-650 font-bold block mt-0.5">ยาต้องเฝ้าระวัง</span>
                </div>
              </div>

              {/* Card 6: Destroyed */}
              <div 
                onClick={() => setStatusFilter('DESTROYED')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'DESTROYED' ? 'border-neutral-500 ring-4 ring-neutral-500/15 scale-[1.02] shadow-md' : 'border-neutral-300'
                }`}
              >
                <div className="flex justify-between items-start text-neutral-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-550">ทำลายแล้ว</span>
                  <Trash size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-neutral-600">{stats.destroyed}</span>
                  <span className="text-[10px] text-neutral-500 font-bold block mt-0.5">ตัดยอดสะสม</span>
                </div>
              </div>

              {/* Card 7: Safe */}
              <div 
                onClick={() => setStatusFilter('SAFE')}
                className={`cursor-pointer bg-white rounded-2xl p-4 border-t-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  statusFilter === 'SAFE' ? 'border-emerald-500 ring-4 ring-emerald-500/15 scale-[1.02] shadow-md' : 'border-emerald-450/80'
                }`}
              >
                <div className="flex justify-between items-start text-emerald-500">
                  <span className="text-[11px] font-black uppercase tracking-wider">ปลอดภัย</span>
                  <CheckCircle size={16} />
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-emerald-655">{stats.safe}</span>
                  <span className="text-[10px] text-emerald-500 font-bold block mt-0.5">พร้อมใช้งาน</span>
                </div>
              </div>
            </div>

            {/* Donut Chart 1: สถานะยา (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-gray-900 text-xs">สถานะยา</span>
              </div>
              
              <div className="flex items-center justify-center h-28 relative my-1">
                {stats.total === 0 ? (
                  <div className="text-gray-400 text-xs font-medium">ไม่มีข้อมูล</div>
                ) : (
                  <>
                    <svg className="w-24 h-24 transform -rotate-90">
                      {statusSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="48"
                          cy="48"
                          r="38"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="8"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          className="transition-all duration-300 hover:stroke-[10px] cursor-pointer"
                          onClick={() => setStatusFilter(seg.filterVal as any)}
                        />
                      ))}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center gap-3 text-[10px] font-bold mt-1 flex-wrap">
                <span className={`flex items-center gap-1.5 cursor-pointer hover:text-emerald-600 transition-colors ${statusFilter === 'SAFE' ? 'text-emerald-600 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('SAFE')}>
                  <span className="w-2 h-2 rounded bg-emerald-500 inline-block"></span> ปลอดภัย
                </span>
                <span className={`flex items-center gap-1.5 cursor-pointer hover:text-rose-600 transition-colors ${statusFilter === 'EXPIRED' ? 'text-rose-600 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('EXPIRED')}>
                  <span className="w-2 h-2 rounded bg-rose-550 inline-block"></span> หมดอายุแล้ว
                </span>
                <span className={`flex items-center gap-1.5 cursor-pointer hover:text-amber-500 transition-colors ${statusFilter === 'WARNING_6' ? 'text-amber-500 scale-105' : 'text-gray-500'}`} onClick={() => setStatusFilter('WARNING_6')}>
                  <span className="w-2 h-2 rounded bg-amber-500 inline-block"></span> ใกล้หมดอายุ
                </span>
              </div>
            </div>

            {/* Donut Chart 2: จำนวนยาแยกตามจุดจัดเก็บ (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[180px]">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-gray-900 text-xs">จำนวนยาแยกตามจุดจัดเก็บ</span>
              </div>

              <div className="flex items-center justify-center h-28 relative my-1">
                {stats.total === 0 ? (
                  <div className="text-gray-400 text-xs font-medium">ไม่มีข้อมูล</div>
                ) : (
                  <>
                    <svg className="w-24 h-24 transform -rotate-90">
                      {locationSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="48"
                          cy="48"
                          r="38"
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="8"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          className="transition-all duration-300 hover:stroke-[10px] cursor-pointer"
                          onClick={() => setSourceFilter(seg.filterVal as any)}
                        />
                      ))}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">รายการ</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center gap-6 text-[10px] font-bold mt-1 flex-wrap">
                <span className={`flex items-center gap-1.5 cursor-pointer hover:text-fuchsia-600 transition-colors ${sourceFilter === 'MANUAL' ? 'text-fuchsia-600 scale-105' : 'text-gray-500'}`} onClick={() => setSourceFilter('MANUAL')}>
                  <span className="w-2.5 h-2.5 rounded bg-fuchsia-500 inline-block"></span> ชั้นจุดจ่าย
                </span>
                <span className={`flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors ${sourceFilter === 'SYSTEM' ? 'text-blue-600 scale-105' : 'text-gray-500'}`} onClick={() => setSourceFilter('SYSTEM')}>
                  <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span> สต๊อก
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between print:hidden">
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
                <option value="WARNING_3">ใกล้หมดอายุ (ภายใน 3 เดือน)</option>
                <option value="WARNING_6">ใกล้หมดอายุ (ภายใน 6 เดือน)</option>
                <option value="WARNING_12">ต้องเฝ้าระวัง (9-12 เดือน)</option>
                <option value="SAFE">ปลอดภัย (ปกติ)</option>
                <option value="DESTROYED">ทำลายแล้ว (Destroyed)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up">
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
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider w-24 text-center print:hidden">จัดการ</th>
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
                      const status = getStatusDisplay(item.days_remaining, item.status);
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
                              <span className="font-black text-gray-900">
                                {item.status === 'DESTROYED' ? '0' : (item.qty !== null ? item.qty.toLocaleString() : '-')}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500 uppercase">{item.unit_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center print:hidden">
                            <div className="flex items-center justify-center gap-2">
                              {item.status !== 'DESTROYED' && item.qty !== null && item.qty > 0 && (
                                <button
                                  onClick={() => openDestroyModal(item)}
                                  className="p-2 text-gray-400 hover:text-red-655 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                                  title="ทำลายเวชภัณฑ์จริง (Dispose)"
                                >
                                  <Trash size={18} strokeWidth={2.5} />
                                </button>
                              )}
                              {item.source === 'MANUAL' ? (
                                <>
                                  {item.status !== 'DESTROYED' && (
                                    <button
                                      onClick={() => setEditingItem(item)}
                                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                      title="แก้ไขรายละเอียดรายการนี้"
                                    >
                                      <Edit2 size={18} strokeWidth={2.5} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleManualDelete(item.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                    title="ลบรายการติดตามยานี้"
                                  >
                                    <X size={18} strokeWidth={2.5} />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-bold block" title="ไม่สามารถลบจากหน้านี้ได้ ต้องทำเรื่องตัดจ่ายยา">ระบบ</span>
                              )}
                            </div>
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
      )}

      {/* TAB 2: DISPOSAL & LOSS REPORT */}
      {activeTab === 'DISPOSAL' && (
        <div className="space-y-6">
          {/* Disposal Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between print:hidden animate-fade-in-up">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">กรองตามแหล่งข้อมูล:</span>
              <select
                value={disposalSourceFilter}
                onChange={(e) => setDisposalSourceFilter(e.target.value as any)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-red-400 text-sm font-bold text-gray-700 cursor-pointer shadow-sm"
              >
                <option value="ALL">แหล่งข้อมูลทั้งหมด (In-Stock & Manual)</option>
                <option value="SYSTEM">เฉพาะในคลังเวชภัณฑ์ (In-Stock)</option>
                <option value="MANUAL">เฉพาะบนชั้นจุดจ่าย (Manual Tracking)</option>
              </select>
            </div>
          </div>

          {/* Disposal Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
            {/* Total Loss Value */}
            <div className="bg-gradient-to-br from-red-655 to-red-800 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-red-100 font-extrabold uppercase tracking-wider">มูลค่าความสูญเสียรวม</span>
                <span className="text-3xl font-black mt-2 block">
                  ฿{filteredDisposals.reduce((sum, item) => sum + (item.qty * item.unit_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-[10px] text-red-100/90 font-bold mt-4 pt-2 border-t border-white/10 space-y-1">
                <div className="flex justify-between">
                  <span>ในคลัง (In-Stock):</span>
                  <span>฿{disposalItems.filter(i => i.source === 'SYSTEM').reduce((sum, item) => sum + (item.qty * item.unit_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>ชั้นจ่าย (Manual):</span>
                  <span>฿{disposalItems.filter(i => i.source === 'MANUAL').reduce((sum, item) => sum + (item.qty * item.unit_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Total Disposed Lines */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">จำนวนรายการที่ทำลาย</span>
                <span className="text-3xl font-black text-gray-900 mt-2 block">{filteredDisposals.length}</span>
              </div>
              <div className="text-[10px] text-gray-505 font-bold mt-4 pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between">
                  <span>ในคลัง (In-Stock):</span>
                  <span className="text-gray-700">{disposalItems.filter(i => i.source === 'SYSTEM').length} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span>ชั้นจ่าย (Manual):</span>
                  <span className="text-gray-700">{disposalItems.filter(i => i.source === 'MANUAL').length} รายการ</span>
                </div>
              </div>
            </div>

            {/* Total Quantity */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ปริมาณเวชภัณฑ์ที่ทำลายสะสม</span>
                <span className="text-3xl font-black text-gray-900 mt-2 block">
                  {filteredDisposals.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}
                </span>
              </div>
              <div className="text-[10px] text-gray-505 font-bold mt-4 pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between">
                  <span>ในคลัง (In-Stock):</span>
                  <span className="text-gray-700">{disposalItems.filter(i => i.source === 'SYSTEM').reduce((sum, item) => sum + item.qty, 0).toLocaleString()} ชิ้น</span>
                </div>
                <div className="flex justify-between">
                  <span>ชั้นจ่าย (Manual):</span>
                  <span className="text-gray-700">{disposalItems.filter(i => i.source === 'MANUAL').reduce((sum, item) => sum + item.qty, 0).toLocaleString()} ชิ้น</span>
                </div>
              </div>
            </div>

            {/* Expired vs Others */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">สาเหตุการจำหน่าย (ทั้งหมด)</span>
              <div className="mt-2 space-y-1 text-xs font-bold text-gray-700">
                <div className="flex justify-between">
                  <span>หมดอายุ (EXPIRED):</span>
                  <span className="text-red-655">{disposalItems.filter(i => i.remark === 'EXPIRED').length} ล็อต</span>
                </div>
                <div className="flex justify-between">
                  <span>เสื่อมสภาพ (DAMAGED):</span>
                  <span className="text-amber-600">{disposalItems.filter(i => i.remark === 'DAMAGED').length} ล็อต</span>
                </div>
                <div className="flex justify-between">
                  <span>บริจาค (DONATED):</span>
                  <span className="text-blue-600">{disposalItems.filter(i => i.remark === 'DONATED').length} ล็อต</span>
                </div>
              </div>
            </div>
          </div>

          {/* Disposal Logs Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">วันที่ทำลาย</th>
                    <th className="px-6 py-4 text-center">แหล่งข้อมูล</th>
                    <th className="px-6 py-4">คลังที่ทำลาย</th>
                    <th className="px-6 py-4">เวชภัณฑ์</th>
                    <th className="px-6 py-4 text-center">เลขล็อต</th>
                    <th className="px-6 py-4 text-center">สาเหตุ</th>
                    <th className="px-6 py-4 text-right">จำนวนตัด</th>
                    <th className="px-6 py-4 text-right">ราคา/หน่วย</th>
                    <th className="px-6 py-4 text-right">มูลค่าความสูญเสีย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {isDisposalLoading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="w-8 h-8 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500 font-bold">กำลังโหลดประวัติการทำลายยา...</p>
                      </td>
                    </tr>
                  ) : filteredDisposals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                        ไม่พบประวัติการตัดทำลายเวชภัณฑ์ในประวัติระบบ
                      </td>
                    </tr>
                  ) : (
                    filteredDisposals.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-gray-600">
                          {new Date(item.created_at).toLocaleDateString('th-TH', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            item.source === 'SYSTEM'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            {item.source === 'SYSTEM' ? 'In-Stock' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-700">{item.warehouse_name}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-900">{item.product_name}</span>
                            {item.drug_code && <span className="text-[10px] text-gray-400">รหัส: {item.drug_code}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-gray-600">{item.lot_number}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            item.remark === 'EXPIRED' 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : item.remark === 'DONATED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {item.remark === 'EXPIRED' ? 'หมดอายุ' : item.remark === 'DONATED' ? 'บริจาค' : 'เสื่อมสภาพ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-900">{item.qty.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-600">฿{item.unit_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-black text-red-650">฿{(item.qty * item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEAD STOCK REPORT */}
      {activeTab === 'DEAD_STOCK' && (
        <div className="space-y-6">
          {/* Dead Stock Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between print:hidden animate-fade-in-up">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">เกณฑ์ค้างนิ่งไม่มีการเบิกจ่ายจ่ายสะสม:</span>
              <select
                value={deadStockMonths}
                onChange={(e) => setDeadStockMonths(parseInt(e.target.value))}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-bold text-gray-700 cursor-pointer shadow-sm"
              >
                <option value={1}>ไม่มีการเคลื่อนไหวใน 1 เดือน</option>
                <option value={3}>ไม่มีการเคลื่อนไหวใน 3 เดือน (เกณฑ์คลังมาตรฐาน)</option>
                <option value={6}>ไม่มีการเคลื่อนไหวใน 6 เดือน</option>
                <option value={12}>ไม่มีการเคลื่อนไหวใน 12 เดือน</option>
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
            {/* Total Capital Locked */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between">
              <span className="text-[10px] text-amber-100 font-extrabold uppercase tracking-wider">มูลค่าทุนจมค้างคลังรวม (Locked Capital)</span>
              <span className="text-3xl font-black mt-2">
                ฿{deadStockItems.reduce((sum, item) => sum + item.total_value, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-amber-100/80 font-medium mt-4 font-black">เวชภัณฑ์ที่ถือครองโดยไม่มีการหมุนเวียนเบิกจ่ายออก</span>
            </div>

            {/* Dead Stock Lines */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">จำนวนรายการยาค้างนิ่ง</span>
              <span className="text-3xl font-black text-gray-900 mt-2">{deadStockItems.length}</span>
              <span className="text-xs text-gray-400 font-medium mt-4 font-bold">รายการยาแยกรายตัว</span>
            </div>

            {/* Dead Stock Quantity */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">จำนวนเวชภัณฑ์สะสมในคลังนิ่ง</span>
              <span className="text-3xl font-black text-gray-900 mt-2">
                {deadStockItems.reduce((sum, item) => sum + item.qty, 0).toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 font-medium mt-4 font-bold">ชิ้น/กล่อง ตามหน่วยนับหลัก</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4">รหัสเวชภัณฑ์</th>
                    <th className="px-6 py-4">เวชภัณฑ์</th>
                    <th className="px-6 py-4">คลังที่จัดเก็บ</th>
                    <th className="px-6 py-4 text-right">จำนวนคงเหลือคลัง</th>
                    <th className="px-6 py-4 text-right">ราคาประเมิน/หน่วย</th>
                    <th className="px-6 py-4 text-right">มูลค่าทุนจม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {isDeadStockLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="w-8 h-8 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500 font-bold">กำลังประมวลผลและค้นหาเวชภัณฑ์ค้างนิ่ง...</p>
                      </td>
                    </tr>
                  ) : deadStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-450 font-bold">
                        ไม่พบเวชภัณฑ์ที่ค้างนิ่งในระบบคลัง (ทุกตัวมีการหมุนเวียนปกติ)
                      </td>
                    </tr>
                  ) : (
                    deadStockItems.map(item => (
                      <tr key={item.product_id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-gray-500">{item.drug_code || '-'}</td>
                        <td className="px-6 py-4 font-extrabold text-gray-900">{item.generic_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-bold text-gray-650">{item.location}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-900">
                          {item.qty.toLocaleString()} <span className="text-[10px] text-gray-400 font-bold uppercase">{item.unit_name}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-600">฿{item.unit_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-black text-amber-600">฿{item.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(isModalOpen || editingItem) && (
        <AddManualExpiryModal
          itemToEdit={editingItem || undefined}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingItem(null);
            fetchData();
          }}
        />
      )}

      {destroyingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up my-auto max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-lg font-extrabold flex items-center gap-2">
                  <Trash size={20} />
                  ยืนยันการทำลายเวชภัณฑ์จริง
                </h2>
                <p className="text-red-100 text-xs mt-0.5">ระบบจะหักยอดคงคลังและสร้างประวัติความสูญเสีย</p>
              </div>
              <button 
                onClick={() => setDestroyingItem(null)} 
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                disabled={isDestroySubmitting}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <span className="text-xs text-gray-400 font-bold block">ชื่อเวชภัณฑ์</span>
                <span className="font-extrabold text-gray-900 text-base">{destroyingItem.generic_name}</span>
                {destroyingItem.drug_code && (
                  <span className="text-xs text-gray-500 block">รหัส: {destroyingItem.drug_code}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                <div>
                  <span className="text-xs text-gray-400 font-bold block">เลขล็อต</span>
                  <span className="font-mono font-bold text-gray-800">{destroyingItem.lot_number}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 font-bold block">สถานที่จัดเก็บ</span>
                  <span className="font-bold text-gray-800">{destroyingItem.location}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">จำนวนที่ทำลายจริง</label>
                  <input
                    type="number"
                    min="1"
                    max={destroyingItem.qty || undefined}
                    value={destroyQty}
                    onChange={(e) => setDestroyQty(Math.min(destroyingItem.qty || 999999, Math.max(1, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-red-150 focus:border-red-450 font-black text-lg text-red-600"
                    disabled={isDestroySubmitting}
                  />
                  <span className="text-[10px] text-gray-400 font-medium mt-1 block">
                    คงเหลือในระบบ: {(destroyingItem.qty || 0).toLocaleString()} {destroyingItem.unit_name}
                  </span>
                </div>

                {/* Reason Select */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">สาเหตุการทำลาย</label>
                  <select
                    value={destroyReason}
                    onChange={(e) => setDestroyReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-red-400 font-bold text-gray-700"
                    disabled={isDestroySubmitting}
                  >
                    <option value="EXPIRED">หมดอายุ (EXPIRED)</option>
                    <option value="DAMAGED">ชำรุด/เสื่อมสภาพ (DAMAGED)</option>
                    <option value="DONATED">บริจาค (DONATED)</option>
                  </select>
                </div>
              </div>

              {/* Warning box */}
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-red-800">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <span>
                  <strong>โปรดระวัง:</strong> การดำเนินการนี้จะทำการหักสต๊อกเวชภัณฑ์ออกและบันทึกประวัติการสูญเสียในระบบแบบถาวร ไม่สามารถยกเลิกรายการได้
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDestroyingItem(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-750 font-bold rounded-xl text-sm transition-colors"
                disabled={isDestroySubmitting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDestroy}
                disabled={isDestroySubmitting || destroyQty <= 0}
                className="px-5 py-2 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isDestroySubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash size={16} />
                )}
                ยืนยันทำลายจริง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
