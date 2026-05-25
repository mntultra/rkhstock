import { createClient } from '@supabase/supabase-js';

// ค่าเหล่านี้ดึงมาจากไฟล์ .env (.env.local) หรือ Environment Variables บน Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables! โปรดตรวจสอบไฟล์ .env หรือ Vercel Env Vars');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
