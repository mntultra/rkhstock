# AGENTS.md

Guidance for AI coding agents working in this repository.

---

## Project Overview

RKHSTOCK is a stock management web application built with:

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase/PostgreSQL
- Vercel deployment

Source code lives mainly under `src/`. Database migrations and SQL setup files live under `supabase/`.

---

## Project Structure

```
RKHSTOCK/
├── src/
│   ├── App.tsx                    # Root component, routing
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Global styles (Tailwind base)
│   ├── components/
│   │   ├── AppLayout.tsx          # Shell layout (sidebar, navbar)
│   │   ├── AuthGuard.tsx          # Route protection wrapper
│   │   ├── ProductSearchInput.tsx # Shared product search autocomplete
│   │   └── ui/                    # Reusable UI primitives
│   ├── features/                  # Feature modules (see below)
│   ├── hooks/                     # Shared React hooks
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client singleton
│   │   └── supabase/
│   │       └── queries.ts         # Shared query helpers
│   ├── types/                     # Global TypeScript types
│   └── utils/                     # Pure utility functions
├── supabase/                      # SQL migration files (numbered)
├── public/                        # Static assets
├── index.html
├── vite.config.ts
└── vercel.json                    # Vercel deployment config
```

---

## Feature Modules (`src/features/`)

Each feature lives in its own folder containing components, hooks, and logic specific to that domain.

| Feature           | คำอธิบาย                                          |
|-------------------|----------------------------------------------------|
| `auth`            | การล็อกอิน / ออกจากระบบ                           |
| `dashboard`       | หน้าหลัก / ภาพรวมสต็อก                            |
| `products`        | จัดการสินค้า / รายการวัสดุ                         |
| `stock`           | ดูยอดคงเหลือสต็อกปัจจุบัน                         |
| `receive`         | รับสินค้าเข้าคลัง (Stock Receive)                 |
| `issue`           | จ่ายสินค้าออกจากคลัง (Stock Issue)                |
| `borrow`          | ระบบยืม-คืนวัสดุ                                   |
| `requisition`     | ใบขอเบิก / ใบสั่งซื้อภายใน                        |
| `expiry_tracking` | ติดตามวันหมดอายุ (Lot-based FEFO)                 |
| `expired`         | จัดการสินค้าหมดอายุ                               |
| `notifications`   | ระบบแจ้งเตือน (เช่น สต็อกต่ำ / ใกล้หมดอายุ)       |
| `reports`         | รายงานต่างๆ                                        |
| `officers`        | จัดการเจ้าหน้าที่ที่รับผิดชอบ                     |
| `users`           | จัดการบัญชีผู้ใช้งาน                              |
| `settings`        | ตั้งค่าระบบ / ข้อมูลองค์กร                        |
| `database`        | เครื่องมือดูข้อมูลดิบ (debug / admin)             |
| `help`            | หน้าช่วยเหลือ / คู่มือใช้งาน                      |

---

## Common Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

Run `npm run build` before handing off code changes when practical.

---

## Code Style

- Follow the existing React + TypeScript patterns in `src/`.
- Prefer small, focused changes over broad refactors.
- Keep feature logic close to the relevant feature folder under `src/features/`.
- Reuse shared UI from `src/components/ui/` when possible.
- Reuse shared hooks from `src/hooks/` when the behavior is cross-feature.
- Keep Supabase access patterns consistent with `src/lib/supabase.ts` and `src/lib/supabase/queries.ts`.

---

## Shared Hooks (`src/hooks/`)

| Hook                          | ใช้งานเมื่อ                                            |
|-------------------------------|--------------------------------------------------------|
| `useProductSearch.ts`         | ค้นหาสินค้าแบบ debounced (ใช้คู่กับ ProductSearchInput) |
| `useWarehouses.ts`            | โหลดรายการคลังสินค้าที่มีสิทธิ์เข้าถึง                |
| `useOfficers.ts`              | โหลดรายชื่อเจ้าหน้าที่                                 |
| `useIssueDraft.ts`            | จัดการ draft state สำหรับ issue form (complex state)   |
| `useKeyboardGridNavigator.ts` | นำทางด้วย keyboard ใน data grid / table                |
| `useCellRefs.ts`              | จัดการ refs ของ cell ใน grid (ใช้คู่กับ navigator)     |

---

## Frontend Notes

- This app is an operational stock-management system, so favor clear, compact, task-focused UI.
- Avoid large marketing-style layouts for internal workflows.
- Keep forms keyboard-friendly and easy to scan.
- Use existing icons and visual conventions where available.
- **ภาษา**: UI text ส่วนใหญ่เป็นภาษาไทย — อย่าแปลหรือเปลี่ยนโดยไม่จำเป็น
- **Layout**: ใช้ `AppLayout.tsx` เป็น shell หลัก อย่าสร้าง layout ใหม่ซ้ำซ้อน
- **Loading State**: ใช้ spinner หรือ skeleton ที่สอดคล้องกับ pattern ที่มีอยู่
- **Error Handling**: แสดง error toast / message ให้ผู้ใช้เห็น อย่า swallow silently
- **Form Submit**: ป้องกัน double-submit ด้วย `isSubmitting` state

---

## Database Notes

- SQL changes should be added as new files under `supabase/` unless the user explicitly asks to modify an existing migration/setup file.
- Migration files use a numeric prefix (e.g. `01_`, `02_`) to indicate order — use the next available number for new files.
- Files without numeric prefix (e.g. `fix_users_rls.sql`) are one-off fixes.
- Be careful with RLS, triggers, RPC functions, and stock-balance logic.
- Do not commit secrets or Supabase service-role keys.

### Key Tables

| Table | หมายเหตุ |
|---|---|
| `stock_balances` | ยอดคงเหลือ — อัปเดตผ่าน trigger/RPC เท่านั้น ห้ามแก้ตรง |
| `stock_movements` / `stock_movement_items` | บันทึกความเคลื่อนไหว (receive/issue/void) |
| `lots` | ข้อมูล lot และวันหมดอายุ สำหรับระบบ FEFO |
| `products` | ข้อมูลสินค้า (ชื่อ, หน่วย, safety stock) |
| `requisitions` / `requisition_items` | ใบขอเบิก |
| `borrows` | ระบบยืม-คืน |
| `manual_expirations` | บันทึกวันหมดอายุแบบ manual |
| `officers` | เจ้าหน้าที่ที่ผูกกับ movement (ผู้รับ/ผู้จ่าย) |

### Key RPC Functions

- `deduct_stock(...)` — หักสต็อก (FEFO) เมื่อ issue
- `void_stock_movement(...)` — ยกเลิก movement พร้อม reverse สต็อก
- `get_usage_rate(...)` — คำนวณอัตราการใช้เฉลี่ย
- `get_inventory_analysis(...)` — วิเคราะห์สต็อกเพื่อการสั่งซื้อ
- `get_active_product_ids(...)` — ดึง products ที่ยังใช้งานอยู่

> ⚠️ อย่าแก้ไข RPC functions โดยตรงใน code — ให้เพิ่ม migration SQL ใหม่แทนเสมอ

### Supabase Query Pattern

```typescript
// ✅ ถูกต้อง — ใช้ supabase client จาก lib
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('products')
  .select('id, name, unit')
  .eq('is_active', true)
  .order('name');

// ❌ อย่าสร้าง supabase client ใหม่เอง
```

---

## TypeScript Guidelines

- ใช้ type จาก `src/types/` สำหรับ domain objects (products, movements ฯลฯ)
- อย่าใช้ `any` — ใช้ `unknown` แล้ว narrow แทน
- Supabase response types ควรระบุ generic เสมอ เช่น `data: Product[] | null`
- อย่า cast แบบ `as` โดยไม่มีการตรวจสอบ

---

## Environment

Expected local environment variables are Vite-style public keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not store real secrets in tracked files. Environment variables for production must be set in the Vercel dashboard, not in code.

---

## Verification

For code changes, prefer this order:

1. Run targeted checks when available.
2. Run `npm run build`.
3. Manually inspect affected UI flows when a browser/dev server is needed.

There is currently no dedicated test script in `package.json`.

---

## Deployment

- **Platform**: Vercel (config อยู่ที่ `vercel.json`)
- **Build command**: `npm run build`
- **Output directory**: `dist/`

---

## Agent Safety

- Do not revert user changes unless explicitly asked.
- Do not rewrite unrelated files.
- Avoid destructive git or filesystem operations.
- Preserve existing Thai user-facing text and domain wording unless a change specifically requires editing it.
- อย่าแก้ไข `stock_balances` โดยตรง — ต้องผ่าน RPC หรือ trigger เท่านั้น
- อย่าเพิ่ม `VITE_SUPABASE_SERVICE_ROLE_KEY` หรือ secret ใดๆ ใน tracked files
- อย่าลบหรือ rename migration files ที่มีอยู่แล้ว
- อย่าแตะ `.env` และ `.env.local` — เป็น local secrets
