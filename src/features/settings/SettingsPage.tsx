import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Building2, Calendar, Users, Package, FileType, CheckCircle, Search, Plus, Edit2, Trash2, X, Beaker, Briefcase, Pill, DivideSquare as DivideSquareIcon, LayoutGrid, UserCircle, ChevronDown, Check } from 'lucide-react';
import { OrganizationInfo, } from '@/types';
import { useOfficers } from '@/hooks/useOfficers';

// Generic CRUD List Component
interface SimpleCrudProps {
  title: string;
  tableName: string;
  icon: React.ReactNode;
  columns: { key: string, label: string }[];
  searchFields: string[];
  checkUsageTables: { table: string, field: string, matchField?: string }[];
}

function SimpleCrudList({ title, tableName, icon, columns, searchFields, checkUsageTables }: SimpleCrudProps) {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  const fetchItems = async () => {
    setIsLoading(true);
    let query = supabase.from(tableName).select('*').order('created_at', { ascending: false });
    if (search && searchFields.length > 0) {
      const orQuery = searchFields.map(f => `${f}.ilike.%${search}%`).join(',');
      query = query.or(orQuery);
    }
    const { data, error } = await query;
    if (data) setItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const hasActiveFilter = columns.some(col => col.key === 'is_active');
  const activeCount = items.filter(item => item.is_active !== false).length;
  const inactiveCount = items.filter(item => item.is_active === false).length;

  const filteredItems = hasActiveFilter
    ? items.filter(item => activeTab === 'active' ? item.is_active !== false : item.is_active === false)
    : items;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let error;
      if (editingItem) {
        const { error: err } = await supabase.from(tableName).update(formData).eq('id', editingItem.id);
        error = err;
      } else {
        // Generate ID manually in case some older tables don't have default gen_random_uuid()
        const payload = { ...formData, id: crypto.randomUUID() };
        const { error: err } = await supabase.from(tableName).insert([payload]);
        error = err;
      }
      if (error) throw error;
      setIsModalOpen(false);
      fetchItems();
    } catch (err: any) {
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;

    const item = items.find(x => x.id === id);

    // Check usage
    let hasUsage = false;
    for (const check of checkUsageTables) {
      const matchValue = check.matchField && item ? item[check.matchField] : id;
      const { data, error } = await supabase.from(check.table).select('id').eq(check.field, matchValue).limit(1);
      if (data && data.length > 0) {
        hasUsage = true;
        break;
      }
    }

    if (hasUsage) {
      if (hasActiveFilter) {
        if (confirm('รายการนี้ถูกใช้งานในระบบแล้ว ไม่สามารถลบถาวรได้ ต้องการเปลี่ยนสถานะเป็น "ระงับการใช้งาน" แทนการลบถาวรหรือไม่?')) {
          const { error } = await supabase.from(tableName).update({ is_active: false }).eq('id', id);
          if (error) {
            alert('ไม่สามารถระงับการใช้งานได้: ' + error.message);
          } else {
            fetchItems();
          }
        }
      } else {
        alert('ไม่สามารถลบได้ เนื่องจากรายการนี้ถูกใช้งานแล้วในระบบ');
      }
      return;
    }

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      fetchItems();
    } catch (err: any) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    const initialData: any = {};
    columns.forEach(col => {
      if (col.key === 'is_active') {
        initialData[col.key] = true;
      } else {
        initialData[col.key] = '';
      }
    });
    setFormData(initialData);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <button onClick={openAddModal} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm shrink-0">
            <Plus size={16} /> เพิ่มข้อมูล
          </button>
        </div>
      </div>

      {hasActiveFilter && (
        <div className="flex flex-wrap gap-2 items-center bg-gray-50/50 p-2.5 rounded-2xl border border-gray-150 shadow-sm mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${activeTab === 'active'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-650 text-white shadow-md shadow-blue-600/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-blue-755 hover:border-blue-200 hover:bg-blue-50/30'
              }`}
          >
            <CheckCircle size={15} className={activeTab === 'active' ? 'animate-pulse' : ''} />
            <span>เปิดใช้งานอยู่ (Active)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono transition-colors ${activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}>
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inactive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${activeTab === 'inactive'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/30'
              }`}
          >
            <X size={15} />
            <span>ระงับการใช้งาน (Is Not Active)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono transition-colors ${activeTab === 'inactive' ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-700 border border-orange-100'
              }`}>
              {inactiveCount}
            </span>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{col.label}</th>
              ))}
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={columns.length + 1} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="p-8 text-center text-gray-400">ไม่มีข้อมูล</td></tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                      {typeof item[col.key] === 'boolean' ? (item[col.key] ? '✅ ใช้งาน' : '❌ ปิดใช้งาน') : item[col.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editingItem ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {columns.map(col => (
                <div key={col.key}>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{col.label}</label>
                  {typeof formData[col.key] === 'boolean' || col.key === 'is_active' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData[col.key]}
                        onChange={e => setFormData({ ...formData, [col.key]: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">เปิดใช้งาน (Active)</span>
                    </label>
                  ) : (
                    <input
                      type="text"
                      required={col.key !== 'abbreviation' && col.key !== 'main_category'}
                      value={formData[col.key] || ''}
                      onChange={e => setFormData({ ...formData, [col.key]: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  )}
                </div>
              ))}
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components for specialized tabs

function StockSettingsTab() {
  const [info, setInfo] = useState<OrganizationInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<OrganizationInfo>>({});

  useEffect(() => {
    supabase.from('organization_info').select('*').limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setInfo(data[0]);
        setFormData(data[0]);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (info?.id) {
        const { error } = await supabase.from('organization_info').update({
          requisition_avg_months: formData.requisition_avg_months,
          safety_stock_months: formData.safety_stock_months
        }).eq('id', info.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('organization_info').insert([formData]).select();
        if (error) throw error;
        if (data) setInfo(data[0]);
      }
      setInfo({ ...info, ...formData } as OrganizationInfo);
      setIsEditing(false);
      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err: any) {
      console.error('Save stock settings error:', err);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">⚙️ Auto Rate & Safety Stock</h2>
        {!isEditing && <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg"><Edit2 size={16} /> แก้ไขข้อมูล</button>}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: Auto Rate */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(59,130,246,0.08)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -top-6 -right-6 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity transform group-hover:scale-110 group-hover:rotate-6 duration-500">
              <Calendar size={120} className="text-blue-600" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50/80 text-blue-600 rounded-xl border border-blue-100 shadow-sm shadow-blue-100/50">
                  <Calendar size={22} strokeWidth={2.5} />
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">ดึงประวัติย้อนหลัง (Auto Rate)</h3>
              </div>
              
              <p className="text-[13px] text-gray-500 mb-8 leading-relaxed flex-1">
                กำหนดจำนวนเดือนที่ระบบจะใช้ดึงประวัติมาคำนวณอัตราการใช้เฉลี่ยและสถิติเบิกจ่าย เมื่อกดปุ่ม <strong>"ดึงรายการทั้งหมด"</strong> ในหน้าเบิก
              </p>
              
              <div className="space-y-2 mt-auto">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                  เลือกระยะเวลาย้อนหลัง
                </label>
                <div className="relative group/select">
                  <select
                    disabled={!isEditing}
                    value={formData.requisition_avg_months ?? 6}
                    onChange={e => setFormData({ ...formData, requisition_avg_months: parseInt(e.target.value) })}
                    className="appearance-none w-full px-5 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:bg-gray-50 disabled:text-gray-400 font-bold text-gray-800 text-sm cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <option value={3}>ย้อนหลัง 3 เดือน</option>
                    <option value={6}>ย้อนหลัง 6 เดือน (ค่าเริ่มต้น)</option>
                    <option value={9}>ย้อนหลัง 9 เดือน</option>
                    <option value={12}>ย้อนหลัง 12 เดือน (1 ปี)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 group-hover/select:text-blue-500 transition-colors">
                    <ChevronDown size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Safety Stock */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(168,85,247,0.08)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute -top-6 -right-6 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity transform group-hover:scale-110 group-hover:rotate-6 duration-500">
              <Package size={120} className="text-purple-600" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-purple-50/80 text-purple-600 rounded-xl border border-purple-100 shadow-sm shadow-purple-100/50">
                  <Package size={22} strokeWidth={2.5} />
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">สำรองคลัง (Safety Stock)</h3>
              </div>
              
              <p className="text-[13px] text-gray-500 mb-8 leading-relaxed flex-1">
                จำนวนเดือนที่ระบบจะใช้เป็นตัวคูณในการตั้งเป้าหมายสต๊อกเพื่อ <strong>เสนอแนะยอดเบิกจ่ายอัตโนมัติ</strong> ในหน้าฟอร์มใบเบิกเวชภัณฑ์
              </p>
              
              <div className="space-y-2 mt-auto">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                  เลือกจำนวนเดือนสำรองคลัง
                </label>
                <div className="relative group/select">
                  <select
                    disabled={!isEditing}
                    value={formData.safety_stock_months ?? 1}
                    onChange={e => setFormData({ ...formData, safety_stock_months: parseInt(e.target.value) })}
                    className="appearance-none w-full px-5 py-3.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 disabled:bg-gray-50 disabled:text-gray-400 font-bold text-gray-800 text-sm cursor-pointer shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <option value={1}>สำรอง 1 เดือน (ค่าเริ่มต้น)</option>
                    <option value={2}>สำรอง 2 เดือน</option>
                    <option value={3}>สำรอง 3 เดือน</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 group-hover/select:text-purple-500 transition-colors">
                    <ChevronDown size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {isEditing && (
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100/60">
            <button type="button" onClick={() => { setIsEditing(false); setFormData(info || {}); }} className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-bold text-gray-600 transition-all duration-200">ยกเลิก</button>
            <button type="submit" className="px-7 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5">บันทึกการตั้งค่า</button>
          </div>
        )}
      </form>
    </div>
  );
}


function OrganizationInfoTab() {
  const [info, setInfo] = useState<OrganizationInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<OrganizationInfo>>({});

  useEffect(() => {
    supabase.from('organization_info').select('*').limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setInfo(data[0]);
        setFormData(data[0]);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (info?.id) {
        const { error } = await supabase.from('organization_info').update(formData).eq('id', info.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('organization_info').insert([formData]).select();
        if (error) throw error;
        if (data) setInfo(data[0]);
      }
      setInfo(formData as OrganizationInfo);
      setIsEditing(false);
      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err: any) {
      console.error('Save organization settings error:', err);
      if (err.message?.includes('safety_stock_months') || err.code === '42703') {
        alert('บันทึกข้อมูลไม่สำเร็จ: กรุณารันสคริปต์ SQL Migration (23_add_safety_stock_months.sql) ในระบบหลังบ้านเพื่อเพิ่มฟิลด์ปุ่มเลือกสำรองคลังก่อน\n\nรายละเอียด: ' + err.message);
      } else {
        alert('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Building2 className="text-blue-600" /> ข้อมูลชื่อและที่อยู่ส่วนราชการ</h2>
        {!isEditing && <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg"><Edit2 size={16} /> แก้ไขข้อมูล</button>}
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อองค์กร / โรงพยาบาล</label>
              <input disabled={!isEditing} required type="text" value={formData.org_name || ''} onChange={e => setFormData({ ...formData, org_name: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500 font-medium text-lg" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ที่อยู่เลขที่ / หมู่</label>
              <input disabled={!isEditing} type="text" value={formData.address_no || ''} onChange={e => setFormData({ ...formData, address_no: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ตำบล</label>
              <input disabled={!isEditing} type="text" value={formData.subdistrict || ''} onChange={e => setFormData({ ...formData, subdistrict: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">อำเภอ</label>
              <input disabled={!isEditing} type="text" value={formData.district || ''} onChange={e => setFormData({ ...formData, district: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">จังหวัด</label>
              <input disabled={!isEditing} type="text" value={formData.province || ''} onChange={e => setFormData({ ...formData, province: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">รหัสไปรษณีย์</label>
              <input disabled={!isEditing} type="text" value={formData.postal_code || ''} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
              <input disabled={!isEditing} type="text" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">โทรสาร (Fax)</label>
              <input disabled={!isEditing} type="text" value={formData.fax || ''} onChange={e => setFormData({ ...formData, fax: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none disabled:bg-gray-100 disabled:text-gray-500" />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-3 mt-4 border-t pt-6">
            <button type="button" onClick={() => { setIsEditing(false); setFormData(info || {}); }} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-700">ยกเลิก</button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md">บันทึกข้อมูลองค์กร</button>
          </div>
        )}
      </form>
    </div>
  );
}

interface CustomOfficerSelectProps {
  value: string;
  onChange: (value: string) => void;
  officers: any[];
  placeholder?: string;
}

function CustomOfficerSelect({ value, onChange, officers, placeholder = '-- ไม่ระบุเจ้าหน้าที่ --' }: CustomOfficerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOfficer = officers.find(s => s.id === value);
  const filteredOfficers = officers.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.position && s.position.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between px-4 py-3 bg-white border ${isOpen
          ? 'border-emerald-500 ring-4 ring-emerald-50 shadow-md'
          : 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
          } rounded-2xl shadow-sm text-left transition-all outline-none duration-200`}
      >
        <div className="flex flex-col min-w-0 pr-2">
          {selectedOfficer ? (
            <>
              <span className="font-extrabold text-gray-900 text-sm leading-tight truncate">
                {selectedOfficer.full_name}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 truncate mt-0.5 leading-none">
                {selectedOfficer.position || 'ยังไม่กำหนดตำแหน่ง'}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-gray-400 italic">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''} shrink-0`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-md border border-gray-100/90 rounded-2xl shadow-xl shadow-emerald-950/10 overflow-hidden animate-fade-in-down origin-top">
          {/* Search Box */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Search size={16} className="text-emerald-500 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือตำแหน่ง..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent px-2 py-1.5 text-xs sm:text-sm font-semibold outline-none text-gray-800 placeholder-gray-400"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-red-500 text-xs font-bold px-2 shrink-0 transition-colors"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50/80">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors ${!value ? 'bg-emerald-50/50 text-emerald-700 font-extrabold' : 'text-gray-400 hover:bg-gray-50'
                }`}
            >
              -- ไม่ระบุเจ้าหน้าที่ --
            </button>

            {filteredOfficers.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 italic">
                ไม่พบเจ้าหน้าที่ในระบบ
              </div>
            ) : (
              filteredOfficers.map(s => {
                const isSelected = s.id === value;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors duration-150 ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-emerald-50/30'
                      }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`text-xs sm:text-sm ${isSelected ? 'text-emerald-900 font-black' : 'text-gray-700 font-bold'} truncate`}>
                        {s.full_name}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 truncate mt-0.5 leading-none">
                        {s.position || 'ยังไม่กำหนดตำแหน่ง'}
                      </span>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultOfficersTab() {
  const { officers: defaultTabOfficers, isLoading: isOfficersLoading } = useOfficers();
  const [officers, setOfficers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const sections = [
    {
      id: 'executives',
      title: 'ผู้บริหาร/หัวหน้ากลุ่มงาน',
      description: 'กำหนดรายชื่อผู้บริหารและหัวหน้ากลุ่มงานในการอนุมัติภาพรวม',
      borderColor: 'border-l-4 border-emerald-500',
      icon: <Building2 className="text-emerald-600" size={20} />,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      roles: [
        { key: 'director', label: 'ผู้อำนวยการโรงพยาบาล' },
        { key: 'head_pharmacy', label: 'หัวหน้ากลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค' },
      ]
    },
    {
      id: 'main_warehouse',
      title: 'เจ้าหน้าที่คลังหลัก (Main Warehouse)',
      description: 'กำหนดรายชื่อเจ้าหน้าที่ผู้รับผิดชอบการบริหารจัดการและจ่ายเวชภัณฑ์จากคลังหลัก',
      borderColor: 'border-l-4 border-blue-500',
      icon: <LayoutGrid className="text-blue-600" size={20} />,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      roles: [
        { key: 'head_main_warehouse', label: 'หัวหน้าหน่วยคลัง (คลังหลัก)' },
        { key: 'dispenser_main_warehouse', label: 'ผู้จ่ายเวชภัณฑ์ (คลังหลัก)' },
        { key: 'approver_main_warehouse', label: 'ผู้อนุมัติจ่ายเวชภัณฑ์ (คลังหลัก)' },
      ]
    },
    {
      id: 'sub_warehouse',
      title: 'เจ้าหน้าที่คลังย่อย (Sub-Warehouse)',
      description: 'กำหนดรายชื่อเจ้าหน้าที่ผู้ทำหน้าที่เบิก รับ และจ่ายเวชภัณฑ์ในคลังยาย่อย',
      borderColor: 'border-l-4 border-amber-500',
      icon: <Pill className="text-amber-500" size={20} />,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      roles: [
        { key: 'requester', label: 'ผู้เบิกเวชภัณฑ์' },
        { key: 'receiver', label: 'ผู้รับเวชภัณฑ์' },
        { key: 'dispenser_sub_warehouse', label: 'ผู้จ่ายเวชภัณฑ์ (คลังย่อย)' },
      ]
    }
  ];

  useEffect(() => {
    const loadData = async () => {
      const { data: oData } = await supabase.from('default_officers').select('*');
      if (oData) {
        const map: Record<string, string> = {};
        oData.forEach(o => map[o.role_key] = o.user_id);
        setOfficers(map);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleChange = async (role_key: string, user_id: string) => {
    setOfficers(prev => ({ ...prev, [role_key]: user_id }));
    try {
      const { error } = await supabase.from('default_officers').upsert({
        role_key,
        user_id: user_id || null
      });
      if (error) throw error;
    } catch (err: any) {
      alert('บันทึกผู้รับผิดชอบเริ่มต้นไม่สำเร็จ: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-3xl border border-gray-100/80 shadow-sm bg-gradient-to-r from-white to-emerald-50/20">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-200 text-white">
            <CheckCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">ตั้งค่าเริ่มต้นรายชื่อเจ้าหน้าที่ (Default Officers)</h2>
            <p className="text-gray-500 font-medium text-xs sm:text-sm mt-0.5">ระบุเจ้าหน้าที่ที่จะไปแสดงผลในเอกสารและใบงานอัตโนมัติ เพื่อลดความซ้ำซ้อนในการกรอกข้อมูล</p>
          </div>
        </div>
      </div>

      {isLoading || isOfficersLoading ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500">กำลังโหลดรายชื่อค่าเริ่มต้น...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div
              key={section.id}
              className={`bg-white rounded-3xl p-6 shadow-sm border border-gray-100 ${section.borderColor} transition-all hover:shadow-md hover:border-gray-200`}
            >
              <div className="flex items-start sm:items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl border shrink-0 ${section.badgeColor}`}>
                  {section.icon}
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base sm:text-lg">{section.title}</h3>
                  <p className="text-gray-500 font-medium text-[11px] sm:text-xs mt-0.5">{section.description}</p>
                </div>
              </div>

              <div className="divide-y divide-gray-100/70 border-t border-gray-100 mt-2">
                {section.roles.map(role => (
                  <div
                    key={role.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 text-sm sm:text-base">{role.label}</span>
                      <span className="text-[10px] sm:text-xs font-mono text-gray-400">Key: {role.key}</span>
                    </div>
                    <CustomOfficerSelect
                      value={officers[role.key] || ''}
                      onChange={(val) => handleChange(role.key, val)}
                      officers={defaultTabOfficers}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Users Management Tab
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'USER',
    officer_id: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    // Get all users
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (usersData) setUsers(usersData);

    // Get officers for dropdown mapping
    const { data: officersData } = await supabase.from('officers').select('id, full_name').order('full_name');
    if (officersData) setOfficers(officersData);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || '',
      role: user.role || 'USER',
      officer_id: user.officer_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const { error: _error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          officer_id: formData.officer_id || null
        })
        .eq('id', editingUser.id);

      if (_error) throw _error;

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <UserCircle className="text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">จัดการบัญชีผู้ใช้งานระบบ</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">ชื่อผู้ใช้งาน</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">สิทธิ์การใช้งาน</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">เจ้าหน้าที่ที่ผูกไว้</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">ไม่พบข้อมูลผู้ใช้</td></tr>
            ) : (
              users.map(u => {
                const linkedOfficer = officers.find(s => s.id === u.officer_id);
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{u.full_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role || 'USER'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {linkedOfficer ? linkedOfficer.full_name : <span className="text-gray-400 italic">ยังไม่ผูก</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditModal(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">แก้ไขข้อมูลผู้ใช้งาน</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อผู้ใช้งาน</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">สิทธิ์การใช้งาน (Role)</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="USER">USER (ผู้ใช้งานทั่วไป)</option>
                  <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ผูกกับบัญชีเจ้าหน้าที่ (Officer)</label>
                <select
                  value={formData.officer_id}
                  onChange={e => setFormData({ ...formData, officer_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">-- ไม่ผูก --</option>
                  {officers.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// Main Page
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('org');

  const tabs = [
    { id: 'stock_settings', label: 'Auto Rate & Safety Stock', icon: <Settings size={18} /> },
    { id: 'org', label: 'ส่วนราชการ', icon: <Building2 size={18} /> },
    { id: 'fiscal', label: 'ปีงบประมาณ (Fiscal year)', icon: <Calendar size={18} /> },
    { id: 'dept', label: 'กลุ่มงาน', icon: <LayoutGrid size={18} /> },
    { id: 'warehouse', label: 'คลัง/จุดจ่าย (Warehouse)', icon: <Package size={18} /> },
    { id: 'position', label: 'ตำแหน่ง', icon: <Briefcase size={18} /> },
    { id: 'officer', label: 'รายชื่อเจ้าหน้าที่ค่าเริ่มต้น', icon: <CheckCircle size={18} /> },
    { id: 'unit', label: 'หน่วยนับ (Usage unit)', icon: <DivideSquareIcon size={18} /> },
    { id: 'dosage', label: 'รูปแบบเวชภัณฑ์ (Dosage form)', icon: <Pill size={18} /> },
    { id: 'product_type', label: 'ประเภทเวชภัณฑ์ (Product type)', icon: <FileType size={18} /> },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">

      {/* Sidebar Tabs */}
      <div className="w-full md:w-70 shrink-0 bg-white rounded-3xl p-4 shadow-sm border border-gray-100 overflow-y-auto">
        <h2 className="text-lg font-extrabold text-gray-900 mb-4 px-2 flex items-center gap-2">
          <Settings className="text-gray-500" /> ตั้งค่าระบบ (Settings)
        </h2>
        <div className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm text-left ${activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'org' && <OrganizationInfoTab />}
        {activeTab === 'stock_settings' && <StockSettingsTab />}


        {activeTab === 'fiscal' && (
          <SimpleCrudList
            title="ปีงบประมาณ (Fiscal Years)" tableName="master_fiscal_years" icon={<Calendar className="text-blue-600" />}
            columns={[{ key: 'year_name', label: 'ปีงบประมาณ (เช่น 2567)' }, { key: 'is_active', label: 'สถานะใช้งาน' }]}
            searchFields={['year_name']} checkUsageTables={[]} // Assuming no hard usage link for now, could link to requisitions later
          />
        )}

        {activeTab === 'dept' && (
          <SimpleCrudList
            title="กลุ่มงาน / ฝ่าย (Departments)" tableName="master_departments" icon={<LayoutGrid className="text-blue-600" />}
            columns={[{ key: 'name', label: 'ชื่อกลุ่มงาน/ฝ่าย' }]} searchFields={['name']} checkUsageTables={[]}
          />
        )}

        {activeTab === 'warehouse' && (
          <SimpleCrudList
            title="คลัง / ชั้นจุดจ่าย (Warehouses)" tableName="master_warehouses" icon={<Package className="text-blue-600" />}
            columns={[{ key: 'name', label: 'ชื่อคลัง/จุดจ่าย' }, { key: 'is_active', label: 'สถานะ' }]} searchFields={['name']}
            checkUsageTables={[
              { table: 'stock_balances', field: 'warehouse_id' },
              { table: 'stock_movements', field: 'warehouse_id' }
            ]}
          />
        )}

        {activeTab === 'position' && (
          <SimpleCrudList
            title="ตำแหน่งเจ้าหน้าที่ (Staff Positions)" tableName="master_officer_positions" icon={<Briefcase className="text-blue-600" />}
            columns={[{ key: 'name', label: 'ชื่อตำแหน่ง' }, { key: 'is_active', label: 'สถานะ' }]} searchFields={['name']}
            checkUsageTables={[{ table: 'officers', field: 'position', matchField: 'name' }]}
          />
        )}

        {activeTab === 'officer' && <DefaultOfficersTab />}

        {activeTab === 'unit' && (
          <SimpleCrudList
            title="ชื่อหน่วยนับ (Units)" tableName="master_units" icon={<DivideSquareIcon className="text-blue-600" />}
            columns={[{ key: 'unit_name', label: 'ชื่อหน่วยนับ' }, { key: 'is_active', label: 'สถานะ' }]} searchFields={['unit_name']}
            checkUsageTables={[{ table: 'products', field: 'unit_id' }]}
          />
        )}

        {activeTab === 'dosage' && (
          <SimpleCrudList
            title="รูปแบบเวชภัณฑ์ (Dosage Forms)" tableName="master_dosage_forms" icon={<Pill className="text-blue-600" />}
            columns={[
              { key: 'name_en', label: 'ชื่อภาษาอังกฤษ' },
              { key: 'name_th', label: 'ชื่อภาษาไทย' },
              { key: 'abbreviation', label: 'ตัวย่อ' },
              { key: 'main_category', label: 'หมวดหมู่หลัก' },
              { key: 'is_active', label: 'สถานะ' }
            ]}
            searchFields={['name_en', 'name_th', 'abbreviation']}
            checkUsageTables={[{ table: 'products', field: 'dosage_form_id' }]}
          />
        )}

        {activeTab === 'product_type' && (
          <SimpleCrudList
            title="ประเภทเวชภัณฑ์ (Product Types)" tableName="master_product_types" icon={<FileType className="text-blue-600" />}
            columns={[{ key: 'name', label: 'ประเภทเวชภัณฑ์' }, { key: 'is_active', label: 'สถานะ' }]} searchFields={['name']}
            checkUsageTables={[{ table: 'products', field: 'product_type_id' }]}
          />
        )}

      </div>
    </div>
  );
}
