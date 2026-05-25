# RKHSTOCK - ระบบจัดการคลังยาย่อย (Stock Management System)

โปรเจกต์สำหรับบริหารจัดการคลังยา พัฒนาด้วยเทคโนโลยี:
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend & Database:** Supabase (PostgreSQL 15), Row Level Security (RLS)
- **Deployment:** Vercel

---

## 🚀 เริ่มต้นใช้งานสำหรับ Developer ใหม่ (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
โปรเจกต์นี้**ห้ามเก็บ Secrets (รหัสผ่าน/คีย์) ลงใน Git Repository เด็ดขาด** 
ให้ทำการคัดลอกไฟล์ตัวอย่าง `.env.example` ไปเป็นไฟล์ `.env.local` (ไฟล์นี้ถูก ignore ไว้แล้ว):

```bash
cp .env.example .env.local
```
จากนั้นให้กรอกข้อมูลของ Supabase ลงใน `.env.local`:
- `VITE_SUPABASE_URL`: หาได้จาก Settings > API ใน Supabase Dashboard
- `VITE_SUPABASE_ANON_KEY`: หาได้จาก Settings > API ใน Supabase Dashboard (ใช้ Anon `public` key เท่านั้น)

### 3. รัน Development Server
```bash
npm run dev
```
ระบบจะรันขึ้นมาที่ `http://localhost:5173`

---

## 🌐 การนำขึ้นระบบ (Deployment)
โปรเจกต์นี้ตั้งค่า Auto-deploy ไว้กับ **Vercel** ผ่าน GitHub:
1. เมื่อทำการ `git push` ไปยัง Branch หลัก (เช่น `main`) Vercel จะทำการ Build และ Deploy ให้ทันที
2. รองรับ SPA (Single Page Application) Routing เรียบร้อยแล้ว (ผ่านการตั้งค่าในไฟล์ `vercel.json`)
3. **⚠️ ข้อควรระวัง:** ต้องไปตั้งค่า Environment Variables (`VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`) ใน Vercel Dashboard > Project Settings > Environment Variables เพื่อให้โค้ดชุด Production สามารถต่อฐานข้อมูลได้
