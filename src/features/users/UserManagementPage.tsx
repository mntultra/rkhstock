import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Officer } from '@/types';
import { Users, Shield, Link as LinkIcon, Search, AlertCircle, CheckCircle, Edit2, X, RefreshCw } from 'lucide-react';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editOfficerId, setEditOfficerId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (usersError) throw usersError;
      
      // Fetch Officers for linking
      const { data: officersData, error: officersError } = await supabase
        .from('officers')
        .select('*')
        .order('full_name');
        
      if (officersError) throw officersError;
      
      setUsers(usersData || []);
      setOfficers(officersData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลผู้ใช้งานได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleEditClick = (user: User) => {
    setEditingUserId(user.id);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'USER');
    setEditOfficerId(user.officer_id || null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditFullName('');
    setEditEmail('');
    setEditRole('USER');
    setEditOfficerId(null);
  };

  const handleSaveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          full_name: editFullName,
          email: editEmail,
          role: editRole,
          officer_id: editOfficerId || null
        })
        .eq('id', userId);

      if (error) throw error;

      showMessage('success', 'บันทึกการเปลี่ยนแปลงสิทธิ์เรียบร้อยแล้ว');
      setEditingUserId(null);
      fetchData(); // Refresh list
    } catch (err: any) {
      showMessage('error', 'เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const getOfficerName = (officerId?: string) => {
    if (!officerId) return '-';
    const officer = officers.find(s => s.id === officerId);
    return officer ? officer.full_name : '-';
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            จัดการบัญชีผู้ใช้งานระบบ
          </h1>
          <p className="text-gray-500 mt-1">กำหนดสิทธิ์การใช้งานระบบ และเชื่อมโยงบัญชีผู้ใช้เข้ากับฐานข้อมูลเจ้าหน้าที่</p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium"
          >
            <RefreshCw size={18} /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-blue-800">
        <AlertCircle className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold">ข้อมูลบัญชีผู้ใช้ (System Users)</p>
          <p>บัญชีผู้ใช้จะเกิดขึ้นเมื่อมีการ <b>Sign Up (สมัครสมาชิก)</b> หรือ <b>รับคำเชิญผ่านอีเมล (Invite)</b> จากระบบ Supabase Auth เท่านั้น<br/>
          แอดมินระบบมีหน้าที่เพียงกำหนดว่าให้บัญชีนั้นมีสิทธิ์ระดับไหน (ADMIN/USER) และบัญชีนั้นคือเจ้าหน้าที่ (Officer) คนใดในโรงพยาบาล</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Search & List */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อผู้ใช้ หรืออีเมล..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">บัญชีผู้ใช้งาน (อีเมล/ชื่อ)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">สิทธิ์การใช้งาน (Role)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ผูกกับเจ้าหน้าที่ (Officer Profile)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="animate-spin text-blue-500" size={24} />
                      <p>กำลังโหลดข้อมูล...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    ไม่พบข้อมูลผู้ใช้งานระบบ
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isEditing = editingUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editFullName}
                              onChange={(e) => setEditFullName(e.target.value)}
                              placeholder="ชื่อ-นามสกุล"
                              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full"
                            />
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="อีเมล"
                              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{user.full_name || 'ไม่ระบุชื่อ'}</span>
                            <span className="text-sm text-gray-500">{user.email || 'ไม่มีอีเมล'}</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select 
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="USER">USER (ผู้ใช้งานทั่วไป)</option>
                            <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            <Shield size={14} />
                            {user.role || 'USER'}
                          </span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select 
                            value={editOfficerId || ''}
                            onChange={(e) => setEditOfficerId(e.target.value || null)}
                            className="w-full max-w-[250px] px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">-- ไม่ผูกกับเจ้าหน้าที่ท่านใด --</option>
                            {officers.map(s => (
                              <option key={s.id} value={s.id}>{s.full_name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            {user.officer_id ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">
                                <LinkIcon size={14} />
                                {getOfficerName(user.officer_id)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400 italic">ยังไม่ได้เชื่อมโยง</span>
                            )}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={handleCancelEdit}
                              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                              title="ยกเลิก"
                            >
                              <X size={18} />
                            </button>
                            <button 
                              onClick={() => handleSaveUser(user.id)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                              title="บันทึก"
                            >
                              <CheckCircle size={18} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleEditClick(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm flex items-center gap-1 ml-auto"
                          >
                            <Edit2 size={16} /> แก้ไขข้อมูล
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
