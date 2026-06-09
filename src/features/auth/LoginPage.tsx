import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  Mail, 
  Lock, 
  Leaf, 
  ArrowRight,
  X,
  Volume2,
  Sparkles,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import forestBg from './forest_login_background.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [activeTab, setActiveTab] = useState(1);

  // รับ URL เดิมที่ User พยายามจะเข้าถึง (ถ้ามี)
  const from = location.state?.from?.pathname || '/';

  // Auto cycle branding tabs every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((prev) => (prev % 4) + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // ล็อกอินสำเร็จ พากลับไปหน้าเดิม
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' 
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' 
        : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const tabsContent = [
    {
      id: 1,
      title: 'FOREST',
      subtitle: 'NATURE & SUSTAINABILITY',
      desc: 'ผืนป่าคือปอดของโลก คลังเวชภัณฑ์คือหัวใจของสุขภาพ RKHSTOCK มุ่งมั่นพัฒนาคลังเวชภัณฑ์ดิจิทัลแบบไร้กระดาษ (Paperless 100%) เพื่อช่วยปกป้องสิ่งแวดล้อมและลดโลกร้อนอย่างยั่งยืน'
    },
    {
      id: 2,
      title: 'STOCK',
      subtitle: 'REAL-TIME MANAGEMENT',
      desc: 'ตรวจสอบและควบคุมคลังเวชภัณฑ์ได้แบบเรียลไทม์ แม่นยำ รวดเร็ว ลดขั้นตอนความซ้ำซ้อนในการเบิกจ่ายเวชภัณฑ์ พร้อมระบบแจ้งเตือนอัจฉริยะเพื่อให้มั่นใจว่ามีเวชภัณฑ์พร้อมดูแลผู้ป่วยเสมอ'
    },
    {
      id: 3,
      title: 'GREEN',
      subtitle: 'ECO-FRIENDLY WORKFLOW',
      desc: 'ยกระดับองค์กรสู่ Green Hospital ด้วยนวัตกรรมการจัดการสต๊อกแบบดิจิทัล ลดขยะ ประหยัดกระดาษ สะดวกต่อการสืบค้นข้อมูล และโปร่งใสในทุกขั้นตอนการตรวจสอบ'
    },
    {
      id: 4,
      title: 'HEALTH',
      subtitle: 'BETTER COMMUNITY CARE',
      desc: 'ประสานงานการดูแลรักษาระหว่างแพทย์ เภสัชกร และเจ้าหน้าที่อย่างมีประสิทธิภาพสูงสุด เพื่อสุขภาพที่ดีของชุมชน ควบคู่กับการดูแลรักษาโลกใบนี้ให้เขียวขจีตลอดไป'
    }
  ];

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-cover bg-center bg-no-repeat relative overflow-hidden font-sans select-none"
      style={{ backgroundImage: `url(${forestBg})` }}
    >
      {/* Dark Forest overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/70 via-black/40 to-emerald-950/30 z-0"></div>

      {/* Background soft ambient lights */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-60 pointer-events-none animate-pulse duration-[8s]"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-96 h-96 bg-green-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-60 pointer-events-none animate-pulse duration-[6s]"></div>

      {/* Main Glassmorphic Container */}
      <div className="relative w-full max-w-6xl md:min-h-[720px] rounded-[32px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col md:flex-row border border-white/10 z-10 backdrop-blur-[2px]">
        
        {/* ================= LEFT COLUMN: GLASSMORPHIC LOGIN ================= */}
        <div className="w-full md:w-[42%] lg:w-[38%] bg-gradient-to-b from-emerald-950/60 to-black/85 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-white/10 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white relative">
          
          {/* Top Logo & App Title */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L19 12H15V21H9V12H5L12 2Z" fill="currentColor" opacity="0.25" />
                <path d="M12 2L19 12H15V21H9V12H5L12 2Z" stroke="currentColor" />
                <path d="M7 8L12 15H10V21H7V15H4L7 8Z" fill="currentColor" opacity="0.15" />
                <path d="M7 8L12 15H10V21H7V15H4L7 8Z" stroke="currentColor" />
                <path d="M17 8L22 15H20V21H17V15H14L17 8Z" fill="currentColor" opacity="0.15" />
                <path d="M17 8L22 15H20V21H17V15H14L17 8Z" stroke="currentColor" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200">RKHSTOCK</span>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider -mt-1">Green Pharmacy Stock</p>
            </div>
          </div>

          {/* "SAVE OUR" Title Heading */}
          <div className="mb-4">
            <h2 className="text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 to-emerald-300 opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              SAVE OUR
            </h2>
            <p className="text-xs text-emerald-400/80 font-bold uppercase tracking-widest mt-1">Health & Nature Through Digital Innovation</p>
          </div>

          {/* Custom Error Alert */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-md px-4 py-3 rounded-2xl text-red-200 text-xs font-semibold mb-6 flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Elegant Glassmorphic Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-emerald-300/80 font-bold ml-1">อีเมล (Email)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-300/50 group-focus-within:text-emerald-400 transition-colors">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-emerald-400/50 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-emerald-100/25 transition-all outline-none focus:bg-white/10 focus:ring-4 focus:ring-emerald-400/10"
                  placeholder="admin@rkhstock.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-emerald-300/80 font-bold ml-1">รหัสผ่าน (Password)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-300/50 group-focus-within:text-emerald-400 transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-emerald-400/50 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-emerald-100/25 transition-all outline-none focus:bg-white/10 focus:ring-4 focus:ring-emerald-400/10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/20 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>กำลังตรวจสอบข้อมูล...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบระบบคลังเวชภัณฑ์</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Minimal footer branding text */}
          <div className="mt-8 text-center text-[10px] text-emerald-300/40">
            <p>© {new Date().getFullYear()} RKHSTOCK. All rights reserved.</p>
            <p className="mt-0.5">Green Pharmacy Information System</p>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: VISUAL BRAND & SHOWCASE ================= */}
        <div className="hidden md:flex md:w-[58%] lg:w-[62%] p-8 lg:p-12 flex-col justify-between text-white relative bg-transparent overflow-hidden">
          
          {/* Top spacer to replace navigation bar */}
          <div className="h-6 z-10"></div>

          {/* Center Brand Hero Section (Changes dynamically based on active tab) */}
          <div className="max-w-[85%] lg:max-w-[75%] my-auto z-10 transition-all duration-500">
            <span className="text-xs font-bold tracking-[0.25em] text-emerald-400 uppercase drop-shadow">
              {tabsContent[activeTab - 1].subtitle}
            </span>
            <h1 className="text-5xl lg:text-7xl font-black tracking-widest text-white mt-2 mb-4 font-sans select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
              {tabsContent[activeTab - 1].title}
            </h1>
            <p className="text-sm lg:text-base leading-relaxed text-emerald-50/90 font-light drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-8 h-20 transition-all">
              {tabsContent[activeTab - 1].desc}
            </p>

            <button 
              onClick={() => setShowImpactModal(true)}
              className="group flex items-center gap-3 bg-white/10 hover:bg-emerald-400 hover:text-emerald-950 backdrop-blur-md border border-white/20 hover:border-emerald-300 hover:scale-105 px-6 py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300 shadow-md hover:shadow-emerald-400/25 cursor-pointer"
            >
              <span>LEARN MORE</span>
              <Sparkles size={14} className="group-hover:rotate-12 transition-transform duration-300" />
            </button>
          </div>

          {/* Bottom Pagination controls (01 ----- 02  03  04) */}
          <div className="flex items-center gap-6 z-10 font-mono select-none">
            {tabsContent.map((tab) => (
              <React.Fragment key={tab.id}>
                {tab.id > 1 && tab.id === activeTab && (
                  <div className="h-[1px] w-12 bg-gradient-to-r from-emerald-400 to-transparent"></div>
                )}
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                    activeTab === tab.id 
                      ? 'text-emerald-400 scale-120' 
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {tab.id.toString().padStart(2, '0')}
                  {activeTab === tab.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  )}
                </button>
                {tab.id === 1 && activeTab === 1 && (
                  <div className="h-[2px] w-20 bg-gradient-to-r from-emerald-400 to-emerald-400/10"></div>
                )}
              </React.Fragment>
            ))}
          </div>

        </div>

      </div>

      {/* ================= GREEN IMPACT DETAILS MODAL ================= */}
      {showImpactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            onClick={() => setShowImpactModal(false)}
            className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity cursor-pointer"
          ></div>

          {/* Modal Content */}
          <div className="relative w-full max-w-lg bg-gradient-to-b from-emerald-950 to-neutral-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl z-10 animate-fade-in">
            <button 
              onClick={() => setShowImpactModal(false)}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/20 flex items-center justify-center border border-emerald-400/30">
                <Leaf className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">คลังเวชภัณฑ์สีเขียว (Green Pharmacy System)</h3>
                <p className="text-xs text-emerald-400">โครงการระบบคลังเวชภัณฑ์ดิจิทัลเพื่อลดใช้กระดาษ RKHSTOCK</p>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-emerald-100/90 font-light">
              <p>
                <strong>RKHSTOCK</strong> ไม่เพียงแต่ถูกพัฒนาขึ้นมาเพื่อระบบคลังเวชภัณฑ์ที่มีประสิทธิภาพ 
                แต่ยังมีหัวใจสำคัญคือการลดการใช้กระดาษในกระบวนการทำงานโรงพยาบาลและ รพ.สต. ลงจนเหลือศูนย์ (100% Paperless)
              </p>
              
              <div className="grid grid-cols-2 gap-4 my-6">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                  <span className="text-xs text-emerald-300 font-bold block uppercase tracking-wider">กระดาษที่ประหยัดได้</span>
                  <span className="text-3xl font-black text-white mt-1 block">15,480+</span>
                  <span className="text-[10px] text-white/50 block">แผ่น / เดือน</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                  <span className="text-xs text-emerald-300 font-bold block uppercase tracking-wider">ช่วยรักษาต้นไม้</span>
                  <span className="text-3xl font-black text-white mt-1 block">1.86</span>
                  <span className="text-[10px] text-white/50 block">ต้น / เดือน</span>
                </div>
              </div>

              <p className="text-xs text-emerald-400/80 bg-emerald-400/5 p-3.5 rounded-2xl border border-emerald-400/10 flex gap-2">
                <Volume2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400 animate-bounce" />
                <span>
                  <strong>Green Impact:</strong> ทุกๆ 8,300 แผ่นกระดาษที่ลดลง ช่วยรักษาต้นไม้อายุ 10 ปี ได้ 1 ต้น 
                  และลดการปล่อยก๊าซเรือนกระจกได้กว่า 50 kg CO2e!
                </span>
              </p>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setShowImpactModal(false)}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-6 py-2.5 rounded-xl text-xs tracking-wider transition-all cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

