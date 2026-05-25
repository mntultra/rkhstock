import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Edit2, Trash2, Pill, Activity, XOctagon } from 'lucide-react';

export default function ProductManagementPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // สำหรับฟอร์มเพิ่ม/แก้ไข (ทำเป็น Modal หรือ Form เล็กๆ ก็ได้)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    drug_code: '',
    generic_name: '',
    trade_name: '',
    is_active: true
  });

  const fetchProducts = async () => {
    setIsLoading(true);
    let query = supabase
      .from('products')
      .select('id, drug_code, generic_name, trade_name, is_active')
      .order('generic_name');
    
    if (search) {
      query = query.or(`generic_name.ilike.%${search}%,trade_name.ilike.%${search}%,drug_code.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setProducts(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update
        await supabase.from('products').update(formData).eq('id', editingId);
      } else {
        // Insert
        await supabase.from('products').insert([formData]);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ drug_code: '', generic_name: '', trade_name: '', is_active: true });
      fetchProducts();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setFormData({
      drug_code: product.drug_code || '',
      generic_name: product.generic_name || '',
      trade_name: product.trade_name || '',
      is_active: product.is_active
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
    fetchProducts();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <Pill size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">จัดการข้อมูลยา</h1>
            <p className="text-sm text-gray-500 font-medium">เพิ่ม แก้ไข หรือระงับการใช้งานเวชภัณฑ์ในคลัง</p>
          </div>
        </div>
        
        <div className="flex w-full sm:w-auto gap-3">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อยา, Trade Name, รหัส..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => { setEditingId(null); setFormData({ drug_code: '', generic_name: '', trade_name: '', is_active: true }); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Plus size={18} /> <span className="hidden sm:inline">เพิ่มยารายการใหม่</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">รหัสยา</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">ชื่อสามัญ (Generic Name)</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">ชื่อการค้า (Trade Name)</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center border-b border-gray-100">สถานะ</th>
              <th className="px-6 py-4 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-right border-b border-gray-100">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="p-10 text-center text-purple-600 font-bold animate-pulse">กำลังโหลดข้อมูล...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-gray-500 font-bold">ไม่พบรายการยา</td></tr>
            ) : (
              products.map((item) => (
                <tr key={item.id} className={`hover:bg-purple-50/50 transition-colors ${!item.is_active && 'opacity-60 bg-gray-50'}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      {item.drug_code || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{item.generic_name}</td>
                  <td className="px-6 py-4 text-gray-600">{item.trade_name || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        <Activity size={14} /> ใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                        <XOctagon size={14} /> ยกเลิก
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleToggleActive(item.id, item.is_active)}
                        className={`p-2 rounded-lg transition-colors ${item.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                        title={item.is_active ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                      >
                        {item.is_active ? <Trash2 size={18} /> : <Activity size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal เพิ่ม/แก้ไขยา */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 sm:p-8 animate-fade-in-up">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">{editingId ? 'แก้ไขข้อมูลยา' : 'เพิ่มยารายการใหม่'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">รหัสยา (Drug Code)</label>
                <input 
                  type="text" required value={formData.drug_code} onChange={e => setFormData({...formData, drug_code: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อสามัญ (Generic Name)</label>
                <input 
                  type="text" required value={formData.generic_name} onChange={e => setFormData({...formData, generic_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none font-bold text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อการค้า (Trade Name)</label>
                <input 
                  type="text" value={formData.trade_name} onChange={e => setFormData({...formData, trade_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-md shadow-purple-200">
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
