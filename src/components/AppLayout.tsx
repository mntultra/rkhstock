import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  X
} from 'lucide-react';

export default function AppLayout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // ดึงข้อมูลอีเมลผู้ใช้ที่ล็อกอินอยู่
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'เบิกยา (Requisition)', path: '/requisition/new', icon: <FileText size={20} /> },
    { name: 'จ่ายยา (Dispense)', path: '/dispense', icon: <PackageMinus size={20} /> },
    { name: 'รับยา (Receive)', path: '/receive', icon: <PackagePlus size={20} /> },
    { name: 'สต๊อกคงเหลือ', path: '/stock', icon: <Boxes size={20} /> },
    { name: 'แจ้งเตือน', path: '/notifications', icon: <Bell size={20} /> },
  ];

  // Component สำหรับเมนู Sidebar (แยกออกมาเพื่อให้ใช้ซ้ำได้ทั้งจอใหญ่และจอมือถือ)
  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
            R
          </div>
          <span className="text-xl font-extrabold text-gray-800 tracking-tight">RKHSTOCK</span>
        </div>
        <button 
          className="md:hidden text-gray-500 hover:bg-gray-100 p-1 rounded" 
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <X size={24} />
        </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`
            }
          >
            {item.icon}
            <span className="text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors text-sm font-bold border border-transparent hover:border-red-100"
        >
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-blue-200">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 shadow-sm z-20">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay ดำๆ เบลอๆ */}
          <div 
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          {/* แถบเมนู */}
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col transform transition-transform">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm h-16 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <button 
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1"></div> {/* ดัน Profile ไปชิดขวา */}

          <div className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-1.5 pr-2 rounded-full transition-colors border border-transparent hover:border-gray-200">
            <div className="text-sm text-right hidden sm:block">
              <p className="font-bold text-gray-800">{userEmail || 'กำลังโหลด...'}</p>
              <p className="text-xs text-blue-600 font-medium">เภสัชกร (Admin)</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full border border-blue-300 flex items-center justify-center text-blue-700 font-bold shadow-inner">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto animate-fade-in-up">
            {/* <Outlet /> คือส่วนที่จะถูกสลับ Component ไปตาม Router (เช่น เอา RequisitionForm มาเสียบตรงนี้) */}
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}
