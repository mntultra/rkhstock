import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  PackagePlus,
  PackageMinus,
  FileText,
  Boxes,
  Bell,
  LogOut,
  Menu,
  X,
  Pill,
  Users,
  ClipboardCheck,
  QrCode,
  FileSpreadsheet,
  Activity,
  Settings,
  Shield,
  ArrowLeftRight,
  Database,
  Trash,
  Pin,
  Globe,
  Keyboard,
  AlertTriangle,
  FileX,
  Clock
} from 'lucide-react';

// โครงสร้างหมวดหมู่เมนูบาร์หลักแบบ Static
const menuGroups = [
  {
    title: 'ภาพรวม & สถิติ (Dashboard)',
    items: [
      { name: 'Dashboard', thName: '(แดชบอร์ดคลังเวชภัณฑ์)', path: '/', icon: <LayoutDashboard size={18} /> },
      { name: 'Notifications', thName: '(รายการแจ้งเตือนคลัง)', path: '/notifications', icon: <Bell size={18} /> },
    ]
  },
  {
    title: 'การดำเนินงานหลัก (Core Operations)',
    items: [
      { name: 'Requisition', thName: '(เบิกเวชภัณฑ์)', path: '/requisition/new', icon: <FileText size={18} /> },
      { name: 'Receive', thName: '(รับเวชภัณฑ์เข้า)', path: '/receive', icon: <PackagePlus size={18} /> },
      { name: 'Dispense', thName: '(จ่ายเวชภัณฑ์)', path: '/dispense', icon: <PackageMinus size={18} /> },
    ]
  },
  {
    title: 'ยอดสต๊อกคงเหลือ (Inventory)',
    items: [
      { name: 'Stock', thName: '(เวชภัณฑ์คงเหลือ)', path: '/stock', icon: <Boxes size={18} /> },
      { name: 'Stock Adjustment', thName: '(ตรวจนับ & ปรับยอดคลัง)', path: '/stock/adjust', icon: <ClipboardCheck size={18} /> },
      { name: 'Expiry Tracking', thName: '(ติดตามยาใกล้หมดอายุ)', path: '/expiry-tracking', icon: <Clock size={18} /> },
      { name: 'Expired & Disposal', thName: '(ตัดจำหน่ายยาหมดอายุ)', path: '/expired', icon: <Trash size={18} className="text-red-400" /> },
    ]
  },
  {
    title: 'ระบบยืม-คืน (Borrow & Return)',
    items: [
      { name: 'Borrow & Return Dashboard', thName: '(แดชบอร์ดข้อมูลยืม-คืน)', path: '/borrow', icon: <ArrowLeftRight size={18} /> },
      { name: 'New Borrow Request', thName: '(ลงทะเบียนยืมเวชภัณฑ์)', path: '/borrow/new', icon: <PackageMinus size={18} /> },
    ]
  },
  {
    title: 'รายงาน & บัญชีคุม (Reports)',
    items: [
      { name: 'Stock Card', thName: '(บัญชีคุมเวชภัณฑ์)', path: '/reports/stock-card', icon: <FileSpreadsheet size={18} /> },
      { name: 'Requisition History', thName: '(ประวัติการขอเบิก)', path: '/requisition/history', icon: <ClipboardCheck size={18} /> },
      { name: 'Stock Movements', thName: '(รายงานการเคลื่อนไหวคลัง)', path: '/reports/movements', icon: <Activity size={18} /> },
      { name: 'Expiry Tracking Report', thName: '(รายงานยาใกล้หมดอายุ)', path: '/expiry-tracking', icon: <Clock size={18} className="text-orange-400" /> },
      { name: 'Unfulfilled Report', thName: '(รายงานเวชภัณฑ์ค้างจ่าย)', path: '/reports/unfulfilled', icon: <FileX size={18} className="text-orange-500" /> },
      { name: 'Negative Stock Report', thName: '(รายงานคลังติดลบ)', path: '/reports/negative-stock', icon: <AlertTriangle size={18} className="text-red-500" /> },
    ]
  },
  {
    title: 'ระบบตั้งค่า & ความปลอดภัย (Settings & Security)',
    items: [
      { name: 'Products', thName: '(ข้อมูลเวชภัณฑ์)', path: '/products', icon: <Pill size={18} /> },
      { name: 'Officers', thName: '(ข้อมูลเจ้าหน้าที่)', path: '/officers', icon: <Users size={18} /> },
      { name: 'Users', thName: '(ผู้ใช้งานระบบ)', path: '/users', icon: <Shield size={18} /> },
      { name: 'Settings', thName: '(ตั้งค่าระบบ)', path: '/settings', icon: <Settings size={18} /> },
      { name: 'Database', thName: '(จัดการฐานข้อมูล)', path: '/database', icon: <Database size={18} /> },
    ]
  },
  {
    title: 'ช่วยเหลือ & คู่มือ (Help)',
    items: [
      { name: 'Keyboard Shortcuts', thName: '(คู่มือปุ่มลัด)', path: '/help/shortcuts', icon: <Keyboard size={18} /> },
    ]
  }
];

const getInitialLetter = (fullName?: string, email?: string): string => {
  if (!fullName) {
    return email ? email[0].toUpperCase() : 'U';
  }
  // Clean prefixes/titles in Thai and English (case-insensitive)
  const cleanName = fullName.replace(
    /^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|ภก\.|ภญ\.|ดร\.|นพ\.|พญ\.|ทพ\.|ทพญ\.|จ\.ส\.ต\.|จ่าสิบตรี|ส\.ต\.|สิบตรี|ส\.ท\.|สิบโท|ส\.อ\.|สิบเอก|ร\.ต\.|ร้อยตรี|ร\.ท\.|ร้อยโท|ร\.อ\.|ร้อยเอก|พ\.ต\.|พันตรี|พ\.ท\.|พันโท|พ\.อ\.|พันเอก|พล\.ต\.|พลตรี|พล\.ท\.|พลโท|พล\.อ\.|พลเอก|ว่าที่\s*ร\.ต\.|ว่าที่ร้อยตรี|Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s*/i,
    ''
  );
  return cleanName ? cleanName[0].toUpperCase() : 'U';
};

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string, email?: string, role?: string } | null>(null);
  const [activeFiscalYear, setActiveFiscalYear] = useState<string>('');

  // States สำหรับย่อแถบเมนูหลักแมนวล
  const [isSidebarSlim, setIsSidebarSlim] = useState(false);

  // State สำหรับเก็บประวัติการปักหมุดเมนูโปรด
  const [pinnedPaths, setPinnedPaths] = useState<string[]>([]);

  // State สำหรับดรอปดาวน์ข้อมูลผู้ใช้ที่มุมขวาบน
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // โหลดข้อมูลผู้ใช้, ปีงบประมาณ และประวัติการปักหมุดโปรด
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email;
        const { data } = await supabase.from('users').select('full_name, role, email').eq('id', session.user.id).single();
        if (data) {
          setUserProfile({ ...data, email: data.email || email });
        } else {
          setUserProfile({ email });
        }
      }
    });

    const fetchActiveYear = async () => {
      try {
        const { data } = await supabase
          .from('master_fiscal_years')
          .select('year_name')
          .eq('is_active', true)
          .maybeSingle();
        if (data) {
          setActiveFiscalYear(data.year_name);
        }
      } catch (err) {
        console.error('Error fetching active fiscal year:', err);
      }
    };
    fetchActiveYear();

    // โหลดค่าเข็มหมุดจาก localStorage
    const savedPins = localStorage.getItem('rkh_pinned_menus');
    if (savedPins) {
      try {
        setPinnedPaths(JSON.parse(savedPins));
      } catch (err) {
        console.error('Error parsing pinned menus:', err);
      }
    }
  }, []);

  // ระบบ Auto-Collapse เมื่อหน้าจอน้อยกว่า 1024px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarSlim(true);
      } else {
        setIsSidebarSlim(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. ถ้ามีการกรอกรหัสผ่านใหม่ ต้องเช็คให้ตรงกัน
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน กรุณาพิมพ์ให้เหมือนกันทั้ง 2 ช่อง');
        return;
      }
      if (newPassword.length < 6) {
        alert('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return;
      }
    }

    setIsChangingPassword(true);
    try {
      // ดึงข้อมูลผู้ใช้ปัจจุบัน
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('ไม่พบเซสชันผู้ใช้งาน');

      // 2. อัปเดตชื่อในตาราง users
      const { error: profileError } = await supabase
        .from('users')
        .update({ full_name: editFullName })
        .eq('id', session.user.id);

      if (profileError) throw profileError;

      // 3. อัปเดตรหัสผ่านถ้ามีการกรอก
      if (newPassword) {
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) throw authError;
      }

      // 4. อัปเดตข้อมูล State ในระบบทันทีเพื่อให้หน้าจอแสดงผลได้ถูกต้อง
      setUserProfile(prev => prev ? { ...prev, full_name: editFullName } : null);

      alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
      setIsChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login');
  }, [navigate]);

  // ฟังก์ชันสลับการปักหมุดเมนู
  const togglePin = useCallback((path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // หยุดการกดลามไปทำงานที่ NavLink

    setPinnedPaths(prev => {
      let next: string[];
      if (prev.includes(path)) {
        next = prev.filter(p => p !== path);
      } else {
        next = [...prev, path];
      }
      localStorage.setItem('rkh_pinned_menus', JSON.stringify(next));
      return next;
    });
  }, []);

  // สร้างหมวดหมู่จำลอง "เมนูโปรดปักหมุด"
  const allMenuGroups = useMemo(() => {
    const pinnedItems = menuGroups
      .flatMap(group => group.items)
      .filter(item => pinnedPaths.includes(item.path));

    return [
      ...(pinnedItems.length > 0
        ? [
          {
            title: 'เมนูโปรดปักหมุด (Pinned Menus)',
            items: pinnedItems.map(item => ({ ...item, isPinnedGroup: true })),
          },
        ]
        : []),
      ...menuGroups
    ];
  }, [pinnedPaths]);

  // ทุกหมวดหมู่เมนูกางออกตลอดเวลาในแนวดิ่งตามความต้องการของผู้ใช้งาน

  return (
    <div className="h-screen overflow-hidden bg-[#f8faf5] flex font-sans selection:bg-emerald-200">

      {/* Sidebar - Desktop (ยืดหดแถบตามสถานะ isSidebarSlim) */}
      <aside className={`print:hidden hidden md:flex flex-col ${isSidebarSlim ? 'w-24' : 'w-80'
        } bg-emerald-950 border-r border-emerald-900/50 shadow-xl z-20 text-emerald-50 h-full transition-all duration-300 overflow-x-hidden`}>
        <SidebarContent
          isSlim={isSidebarSlim}
          pinnedPaths={pinnedPaths}
          togglePin={togglePin}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          userProfile={userProfile}
          handleLogout={handleLogout}
          allMenuGroups={allMenuGroups}
        />
      </aside>

      {/* Sidebar - Mobile Drawer (เต็มแถบเสมอ) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-80 bg-emerald-950 shadow-2xl flex flex-col transform transition-transform text-emerald-50 z-50 h-full">
            <SidebarContent
              isSlim={false}
              pinnedPaths={pinnedPaths}
              togglePin={togglePin}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              userProfile={userProfile}
              handleLogout={handleLogout}
              allMenuGroups={allMenuGroups}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* Top Header */}
        <header className="print:hidden glass border-b border-white shadow-sm h-16 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 hover:text-emerald-600 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>

            {/* Desktop Sidebar Toggle Button (ปุ่ม 3 ขีดสำหรับย่อ/ขยายในแนวนอน) */}
            <button
              className="hidden md:flex p-2 text-gray-600 hover:bg-gray-100 hover:text-emerald-600 rounded-lg transition-colors"
              onClick={() => setIsSidebarSlim(!isSidebarSlim)}
              title={isSidebarSlim ? "ขยายแถบเมนูหลัก" : "ย่อแถบเมนูหลัก"}
            >
              <Menu size={24} />
            </button>
          </div>

          <div className="flex-1 flex items-center pl-4">
            {activeFiscalYear && (
              <div className="glass px-3.5 py-1.5 rounded-full text-xs font-black text-emerald-800 shadow-sm border border-emerald-100/80 bg-emerald-50/50 flex items-center gap-1.5 animate-fade-in-up">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ปีงบประมาณปฏิบัติงาน: {activeFiscalYear}
              </div>
            )}
          </div>

          <div className="relative">
            <div
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-1.5 pr-2 rounded-full transition-colors border border-transparent hover:border-gray-200"
              title="เมนูผู้ใช้งาน"
            >
              <div className="text-sm text-right hidden sm:block">
                <p className="font-bold text-gray-900 leading-tight">{userProfile?.full_name || 'ผู้ใช้งาน'}</p>
                <p className="text-[11px] text-gray-500 leading-tight flex items-center justify-end gap-1.5 mt-0.5">
                  <span>{userProfile?.email || 'กำลังโหลด...'}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-emerald-600 font-extrabold uppercase tracking-wide">{userProfile?.role || 'USER'}</span>
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold shadow-inner shrink-0">
                {getInitialLetter(userProfile?.full_name, userProfile?.email)}
              </div>
            </div>

            {/* User Dropdown Menu */}
            {isProfileDropdownOpen && (
              <>
                {/* Backdrop to close dropdown on click outside */}
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsProfileDropdownOpen(false)}
                />

                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-1.5 animate-fade-in-up origin-top-right">
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setEditFullName(userProfile?.full_name || '');
                      setIsChangePasswordOpen(true);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 w-full transition-colors text-left"
                  >
                    <Settings size={16} className="text-gray-500 group-hover:text-emerald-600" />
                    <span>แก้ไขข้อมูล</span>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 w-full transition-colors text-left"
                  >
                    <LogOut size={16} />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          <div className="max-w-full mx-auto animate-fade-in-up">
            <Outlet />
          </div>
        </main>

        {/* Developer Footer */}
        <footer className="print:hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 text-white py-3 px-4 flex items-center justify-center gap-2 text-xs shrink-0 z-10 shadow-[0_-4px_20px_rgba(16,185,129,0.3)] border-t border-emerald-400/30">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center text-center text-[11px] sm:text-xs tracking-wide">
            <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Globe size={11} className="animate-pulse text-white" />
            </div>
            <span className="font-extrabold text-white uppercase tracking-wider">ติดต่อผู้พัฒนา</span>
            <span className="text-white/40 font-bold">:</span>
            <span className="font-black text-white drop-shadow-sm">จ่าสิบตรี มงคล นุพพล ทองสาย</span>
            <span className="text-white/40 font-bold">•</span>
            <span className="text-emerald-50 font-bold">เจ้าพนักงานเภสัชกรรมชำนาญงาน</span>
            <span className="text-white/40 font-bold">•</span>
            <span className="text-emerald-50 font-bold">mc.thongsai@gmail.com</span>
            <span className="text-white/40 font-bold">•</span>
            <span className="text-emerald-50 font-bold">โทร: 080-7625367</span>
          </div>
        </footer>

      </div>

      {/* Edit Profile Modal */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">แก้ไขข้อมูลส่วนตัว (Edit Profile)</h2>
              <button onClick={() => setIsChangePasswordOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">อีเมลผู้ใช้งาน</label>
                <input
                  type="text"
                  value={userProfile?.email || ''}
                  disabled
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อ-นามสกุลจริง</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-gray-800"
                  placeholder="ชื่อและนามสกุลจริงของคุณ"
                />
              </div>

              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wider">เปลี่ยนรหัสผ่าน (ระบุเมื่อต้องการเปลี่ยนเท่านั้น)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">รหัสผ่านใหม่ (หากต้องการเปลี่ยน)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="อย่างน้อย 6 ตัวอักษร (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">ยืนยันรหัสผ่านใหม่</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md disabled:opacity-50 transition-colors"
                >
                  {isChangingPassword ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// Component สำหรับเมนู Sidebar (แชร์การตั้งค่าระหว่างจอมือถือและจอเดสก์ท็อป)
// Component สำหรับเมนู Sidebar (แชร์การตั้งค่าระหว่างจอมือถือและจอเดสก์ท็อป)
const SidebarContent = ({
  isSlim,
  pinnedPaths,
  togglePin,
  setIsMobileMenuOpen,
  userProfile,
  handleLogout,
  allMenuGroups
}: {
  isSlim: boolean;
  pinnedPaths: string[];
  togglePin: (path: string, e: React.MouseEvent) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  userProfile: { full_name?: string; email?: string; role?: string } | null;
  handleLogout: () => void;
  allMenuGroups: any[];
}) => {
  const [hoverActiveItem, setHoverActiveItem] = useState<{ name: string; rect: DOMRect } | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">

      {/* Header โลโก้คลังยา */}
      <div className={`border-b border-emerald-800/30 flex items-center ${isSlim
        ? 'justify-center py-4 px-2 h-28'
        : 'justify-between px-6 py-4 h-20'
        } shrink-0 transition-all duration-300`}>
        <div className={`flex ${isSlim ? 'flex-col items-center gap-1 text-center' : 'items-center gap-3'}`}>
          <img
            src="/MPH.png"
            alt="MPH Logo"
            className="w-15 h-15 object-contain bg-white rounded-4xl shadow-lg shadow-emerald-900/50 shrink-0 p-0.1"
          />
          {isSlim && (
            <div className="flex flex-col text-[13px] tracking-widest animate-fade-in-up uppercase select-none mt-1 leading-tight text-center">
              <span className="font-normal text-emerald-200/80">RKH</span>
              <span className="font-black text-white">STOCK</span>
            </div>
          )}
          {!isSlim && (
            <div className="flex flex-col animate-fade-in-up leading-tight">
              <span className="text-xl tracking-tight text-white">
                <span className="font-normal text-emerald-100/90">RKH</span>
                <span className="font-black text-white">STOCK</span>
              </span>
              <span className="text-[16px] font-semibold text-emerald-300/90 mt-0 whitespace-nowrap">
                ระบบบริหารคลังเวชภัณฑ์
              </span>
              <span className="text-[14px] font-semibold text-emerald-300/90 whitespace-nowrap">
                กลุ่มงานเภสัชฯ รพ.ร่องคำ
              </span>
            </div>
          )}
        </div>
        {!isSlim && (
          <button
            className="md:hidden text-emerald-400 hover:bg-emerald-950 p-1.5 rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* รายการเมนูคลังหลัก */}
      <nav
        onScroll={() => setHoverActiveItem(null)}
        className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar"
      >
        {allMenuGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">

            {/* แถบหัวข้อหมวดหมู่: ในโหมดปกติแสดงหัวข้อถาวร, โหมด Slim แสดงเส้นแบ่ง */}
            {isSlim ? (
              groupIdx > 0 && <div className="border-t border-emerald-850/60 my-4" />
            ) : (
              <div
                className="px-3.5 py-2 flex items-center text-[10px] font-black text-emerald-400/50 uppercase tracking-widest mb-1 select-none"
              >
                <span className="truncate">{group.title}</span>
              </div>
            )}

            {/* รายการลิงก์ย่อยภายในหมวดหมู่ (แสดงผลตลอดเวลา ไม่หดตัวในแนวดิ่ง) */}
            <div className="space-y-1 transition-all duration-300 opacity-100 visible">
              {group.items.map((item: any) => {
                const isPinned = pinnedPaths.includes(item.path);

                return (
                  <div key={item.name} className="relative group/tooltip flex items-center w-full">
                    <NavLink
                      to={item.path}
                      end
                      onClick={() => setIsMobileMenuOpen(false)}
                      onMouseEnter={(e) => {
                        if (isSlim) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverActiveItem({ name: item.name, rect });
                        }
                      }}
                      onMouseLeave={() => setHoverActiveItem(null)}
                      className={({ isActive }) =>
                        `flex ${isSlim ? 'justify-center items-center p-3.5' : 'items-start justify-between px-4 py-1.5'} w-full rounded-xl transition-all duration-200 ${isActive
                          ? 'bg-emerald-600/90 text-white font-bold shadow-md border border-emerald-500/30'
                          : 'text-emerald-100/70 hover:bg-emerald-800/40 hover:text-white font-medium'
                        }`
                      }
                    >
                      <div className={`flex ${isSlim ? 'items-center justify-center' : 'items-start gap-3 min-w-0 flex-1'}`}>
                        <div className={isSlim ? 'shrink-0' : 'shrink-0 mt-0.5'}>{item.icon}</div>
                        {!isSlim && (
                          <div className="flex flex-col text-left animate-fade-in-up leading-tight min-w-0">
                            <span className="text-sm font-bold truncate">
                              {item.name}
                            </span>
                            {item.thName && (
                              <span className="text-[11px] font-medium opacity-85 truncate mt-0.5">
                                {item.thName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ปุ่มปักหมุด Favorites (แสดงเมื่อ Hover แถบ และซ่อนในกลุ่มปักหมุดเพื่อไม่ให้แสดงซ้ำซ้อน) */}
                      {!isSlim && !(item as any).isPinnedGroup && group.title !== 'เมนูโปรดปักหมุด (Pinned Menus)' && (
                        <button
                          type="button"
                          onClick={(e) => togglePin(item.path, e)}
                          className={`p-1 hover:bg-emerald-800/50 rounded-lg transition-all duration-250 shrink-0 outline-none ${isPinned
                            ? 'text-amber-400 opacity-100'
                            : 'text-emerald-400/20 group-hover/tooltip:opacity-100 opacity-0'
                            }`}
                          title={isPinned ? "ถอนการปักหมุดเมนู" : "ปักหมุดเป็นเมนูใช้บ่อย"}
                        >
                          <Pin
                            size={13}
                            className={`transform transition-all ${isPinned ? 'fill-amber-400 scale-110 rotate-45' : 'hover:scale-110 hover:text-emerald-300'
                              }`}
                          />
                        </button>
                      )}
                    </NavLink>


                  </div>
                );
              })}
            </div>

          </div>
        ))}
      </nav>

      {/* แถบท้ายเมนู: ข้อมูลเจ้าหน้าที่ ปุ่มย่อแถบแมนวล และปุ่มออกจากระบบ */}
      <div className="p-4 border-t border-emerald-950/80 bg-emerald-950 shrink-0">

        {/* ข้อมูลบุคลากร (ซ่อนในโหมด Slim) */}
        {!isSlim && (
          <div className="flex flex-col mb-3 px-4 py-2 bg-emerald-900/40 rounded-xl border border-emerald-800/50 animate-fade-in-up">
            <span className="text-xs font-bold text-emerald-300 truncate">
              {userProfile?.full_name || 'ผู้ใช้งานระบบ'}
            </span>
            <span className="text-[10px] text-emerald-400/60 truncate">
              {userProfile?.email || 'กำลังโหลด...'}
            </span>
          </div>
        )}


        {/* ปุ่มออกจากระบบ */}
        <button
          type="button"
          onClick={handleLogout}
          className={`flex items-center ${isSlim ? 'justify-center p-3.5' : 'gap-3 px-4 py-2.5'} w-full text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded-xl transition-colors duration-200 text-xs font-bold border border-transparent hover:border-red-950/30`}
          title="ออกจากระบบ"
        >
          <div className="shrink-0">
            <LogOut size={18} />
          </div>
          {!isSlim && <span className="truncate">ออกจากระบบ</span>}
        </button>

      </div>

      {/* Premium Sidebar Hover Tooltip (พอร์ทัลแบบ Fixed ป้องกันตำแหน่งเลื่อนหรือโดนบดบังเวลา Scroll) */}
      {hoverActiveItem && (
        <div
          style={{
            position: 'fixed',
            left: `${hoverActiveItem.rect.right + 14}px`,
            top: `${hoverActiveItem.rect.top + hoverActiveItem.rect.height / 2}px`,
          }}
          className="pointer-events-none -translate-y-1/2 px-3.5 py-2.5 bg-emerald-950/95 backdrop-blur-md border border-emerald-700/50 text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-[0_10px_30px_-5px_rgba(4,47,31,0.5)] z-[9999] tracking-wide select-none transition-all duration-150 transform scale-95 animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse shrink-0"></span>
            <span>{hoverActiveItem.name}</span>
          </div>
          {/* Triangle Arrow pointer */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 translate-x-[5px] w-2 h-2 bg-emerald-950 border-l border-b border-emerald-700/50 rotate-45 z-[-1]" />
        </div>
      )}

    </div>
  );
};
