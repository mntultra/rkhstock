import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // ตรวจสอบ Session ตอนโหลด Component ครั้งแรก
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // ดักฟังเหตุการณ์เมื่อมีการ Login / Logout (AuthStateChange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 1. ระหว่างรอเช็ค Session จาก Supabase ให้แสดง Loading
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium text-sm">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  // 2. ถ้าไม่มี Session (ไม่ได้ล็อกอิน) เด้งไปหน้า /login พร้อมแนบ URL เดิมไปด้วย
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. ถ้าล็อกอินแล้ว อนุญาตให้เข้าถึง Component ด้านในได้
  return <>{children}</>;
}
