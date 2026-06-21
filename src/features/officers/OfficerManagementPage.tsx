import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Search, Plus, Edit2, Trash2, User, Briefcase, Mail, Activity, XOctagon } from 'lucide-react';

interface OfficerUser {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  email?: string;
  is_active?: boolean;
}

export default function OfficerManagementPage() {
  const [officers, setOfficers] = useState<OfficerUser[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const standardTitles = ['นาย', 'นาง', 'นางสาว', 'จ่าสิบตรี', 'สิบตรี', 'ว่าที่ร้อยตรี', 'ว่าที่ร้อยตรีหญิง', ''];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: 'นาย',
    first_name: '',
    last_name: '',
    position: '',
    email: ''
  });

  const fetchOfficers = async () => {
    setIsLoading(true);
    let query = supabase.from('officers').select('id, title, first_name, last_name, full_name, position, email, is_active').order('full_name');

    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOfficers(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchPositions = async () => {
      const { data } = await supabase.from('master_officer_positions').select('*').eq('is_active', true).order('name');
      if (data) setPositions(data);
    };
    fetchPositions();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchOfficers();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Counts & Filtering
  const activeCount = officers.filter(s => s.is_active !== false).length;
  const inactiveCount = officers.filter(s => s.is_active === false).length;

  const filteredOfficers = officers.filter(s => 
    activeTab === 'active' ? s.is_active !== false : s.is_active === false
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) return alert('กรุณากรอกชื่อและนามสกุลให้ครบถ้วน');

    const fullName = `${formData.title}${formData.first_name} ${formData.last_name}`;

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('officers')
          .update({
            title: formData.title,
            first_name: formData.first_name,
            last_name: formData.last_name,
            full_name: fullName,
            position: formData.position,
            email: formData.email
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        // Insert (สร้าง id แบบ random uuid สำหรับเจ้าหน้าที่ทั่วไป)
        const { error } = await supabase
          .from('officers')
          .insert([{
            id: crypto.randomUUID(),
            title: formData.title,
            first_name: formData.first_name,
            last_name: formData.last_name,
            full_name: fullName,
            position: formData.position,
            email: formData.email
          }]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingId(null);
      setIsCustomTitle(false);
      setFormData({ title: 'นาย', first_name: '', last_name: '', position: '', email: '' });
      fetchOfficers();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    }
  };

  const handleEdit = (user: OfficerUser) => {
    setEditingId(user.id);

    // ถ้าข้อมูลแยกคำนำหน้าชื่อไม่มี ให้พยายามแยกจาก full_name แบบคร่าวๆ
    let defaultTitle = user.title || 'นาย';
    let defaultFirstName = user.first_name || '';
    let defaultLastName = user.last_name || '';

    if (!user.first_name && user.full_name) {
      const parts = user.full_name.split(' ');
      defaultFirstName = parts[0] || '';
      defaultLastName = parts.slice(1).join(' ') || '';
    }

    setFormData({
      title: defaultTitle,
      first_name: defaultFirstName,
      last_name: defaultLastName,
      position: user.position || '',
      email: user.email || ''
    });

    // Check if it's a custom title
    if (defaultTitle && !standardTitles.includes(defaultTitle)) {
      setIsCustomTitle(true);
    } else {
      setIsCustomTitle(false);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลเจ้าหน้าที่รายนี้?')) return;

    try {
      // ตรวจสอบว่ามีการใช้งานในตารางใบเบิก (requisitions) หรือไม่
      const { data: reqs, error: reqError } = await supabase
        .from('requisitions')
        .select('id')
        .or(`requester_id.eq.${id},approver_id.eq.${id},created_by.eq.${id}`)
        .limit(1);

      if (reqError) throw reqError;

      // ตรวจสอบว่ามีการใช้งานในตารางความเคลื่อนไหวสต๊อก (stock_movements) หรือไม่
      const { data: movs, error: movError } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('created_by', id)
        .limit(1);

      if (movError) throw movError;

      // ถ้าพบการใช้งาน ห้ามลบ แต่เสนอให้เปลี่ยนสถานะเป็น Not Active
      if ((reqs && reqs.length > 0) || (movs && movs.length > 0)) {
        if (confirm('ไม่สามารถลบข้อมูลเจ้าหน้าที่รายนี้ได้อย่างถาวร เนื่องจากมีประวัติการทำรายการในระบบแล้ว\n\nต้องการเปลี่ยนสถานะเป็น "ระงับการใช้งาน" แทนการลบถาวรหรือไม่?')) {
          const { error } = await supabase.from('officers').update({ is_active: false }).eq('id', id);
          if (error) throw error;
          fetchOfficers();
        }
        return;
      }

      // ถ้าไม่มีการใช้งาน ให้ลบได้
      const { error } = await supabase.from('officers').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          throw new Error('ข้อมูลเจ้าหน้าที่รายนี้ถูกอ้างอิงในระบบแล้ว ไม่สามารถลบถาวรได้');
        }
        throw error;
      }

      fetchOfficers();
    } catch (err: any) {
      alert('ไม่สามารถลบข้อมูลได้: ' + err.message);
    }
  };

  // รับย่อชื่อย่อสำหรับทำ Avatar
  const getInitials = (name: string) => {
    if (!name) return '?';
    // เอาเฉพาะชื่อ ไม่เอาคำนำหน้า
    const nameWithoutTitle = name.replace(/^(นาย|นางสาว|นาง|ว่าที่ร้อยตรีหญิง|ว่าที่ร้อยตรี|จ่าสิบตรี|สิบตรี)\s*/, '');
    const parts = nameWithoutTitle.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameWithoutTitle[0] ? nameWithoutTitle[0].toUpperCase() : '?';
  };


  return (
    <div className="glass rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">

      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">ข้อมูลเจ้าหน้าที่</h1>
            <p className="text-sm text-gray-500 font-medium">จัดการรายชื่อ ตำแหน่ง และสิทธิ์ของเจ้าหน้าที่ในระบบ</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row w-full lg:w-auto items-stretch lg:items-center gap-3">
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อเจ้าหน้าที่..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => { setEditingId(null); setIsCustomTitle(false); setFormData({ title: 'นาย', first_name: '', last_name: '', position: '', email: '' }); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm whitespace-nowrap"
          >
            <Plus size={18} /> <span>เพิ่มเจ้าหน้าที่</span>
          </button>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-150 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'active'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-650 text-white shadow-lg shadow-blue-600/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50/30'
          }`}
        >
          <Activity size={16} className={activeTab === 'active' ? 'animate-pulse' : ''} />
          <span>เจ้าหน้าที่ใช้งานปกติ (Active)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold font-mono transition-colors ${
            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inactive')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'inactive'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/30'
          }`}
        >
          <XOctagon size={16} />
          <span>เจ้าหน้าที่ที่ระงับใช้งาน (Is Not Active)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold font-mono transition-colors ${
            activeTab === 'inactive' ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-700 border border-orange-100'
          }`}>
            {inactiveCount}
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">#</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">ชื่อ-นามสกุล</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">ตำแหน่ง</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">อีเมล</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100 text-center">สถานะ</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase text-right border-b border-gray-100">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={5} className="p-10 text-center text-blue-600 font-bold animate-pulse">กำลังโหลดข้อมูลเจ้าหน้าที่...</td></tr>
            ) : filteredOfficers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-16 text-center">
                  <Users className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-gray-500 font-bold">ไม่พบข้อมูลเจ้าหน้าที่</p>
                  <p className="text-sm text-gray-400 mt-1">กดปุ่ม "เพิ่มเจ้าหน้าที่" ด้านบนเพื่อเพิ่มข้อมูลใหม่</p>
                </td>
              </tr>
            ) : (
              filteredOfficers.map((user, index) => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">
                      {user.title || ''}{user.first_name} {user.last_name}
                      {!user.first_name && user.full_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.position ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                        <Briefcase size={12} />
                        {user.position}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">ไม่ระบุ</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.email ? (
                      <span className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Mail size={13} className="text-gray-400" />
                        {user.email}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">ไม่ระบุ</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        ใช้งานปกติ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                        ระงับการใช้งาน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={async () => {
                          const newActiveStatus = user.is_active === false;
                          const { error } = await supabase.from('officers').update({ is_active: newActiveStatus }).eq('id', user.id);
                          if (error) alert('เปลี่ยนสถานะไม่สำเร็จ: ' + error.message);
                          else fetchOfficers();
                        }}
                        className={`p-2 rounded-lg transition-colors ${user.is_active !== false ? 'text-orange-500 hover:bg-orange-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                        title={user.is_active !== false ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                      >
                        {user.is_active !== false ? <XOctagon size={18} /> : <Activity size={18} />}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบเจ้าหน้าที่"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal เพิ่ม/แก้ไขเจ้าหน้าที่ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 sm:p-8 animate-fade-in-up">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">{editingId ? 'แก้ไขข้อมูลเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่ใหม่'}</h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">คำนำหน้า</label>
                  {!isCustomTitle ? (
                    <select
                      value={formData.title}
                      onChange={e => {
                        if (e.target.value === 'CUSTOM') {
                          setIsCustomTitle(true);
                          setFormData({ ...formData, title: '' });
                        } else {
                          setFormData({ ...formData, title: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                      <option value="จ่าสิบตรี">จ่าสิบตรี</option>
                      <option value="สิบตรี">สิบตรี</option>
                      <option value="ว่าที่ร้อยตรี">ว่าที่ร้อยตรี</option>
                      <option value="ว่าที่ร้อยตรีหญิง">ว่าที่ร้อยตรีหญิง</option>
                      <option value="">-- ไม่ระบุ --</option>
                      <option value="CUSTOM">อื่นๆ (พิมพ์เอง)...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="พิมพ์คำนำหน้า"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomTitle(false);
                          setFormData({ ...formData, title: 'นาย' });
                        }}
                        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors border border-gray-200 whitespace-nowrap"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-span-12 sm:col-span-8">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">ชื่อ</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="เช่น สมชาย"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">นามสกุล</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ใจดี"
                  value={formData.last_name}
                  onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">อีเมล</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    placeholder="เช่น user@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">ตำแหน่ง</label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800 appearance-none"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                >
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
