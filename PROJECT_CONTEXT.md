# PROJECT_CONTEXT.md

บริบทโดยรวมของโปรเจกต์ RKHSTOCK สำหรับ AI agents และ developers ใหม่

> ไฟล์นี้รวมเนื้อหาจาก `PROJECT_CONTEXT.md` และ `PROJECT_CONTEXT_2.md` เข้าด้วยกัน

---

## 1. ภาพรวมระบบ (System Overview)

**RKHSTOCK** คือระบบบริหารจัดการคลังยาย่อย (Pharmacy Sub-Stock Management System)
ออกแบบสำหรับหน่วยงานที่ต้องดูแลสต็อกยา / วัสดุทางการแพทย์

### ระบบหลักที่รองรับ

- การล็อกอินและตรวจสิทธิ์ (Authentication-protected internal workflows)
- จัดการสินค้าและบาร์โค้ด (Product and barcode management)
- รับสินค้าเข้าคลัง (Stock receive)
- จ่ายสินค้าออกจากคลัง (Stock issue) พร้อมระบบ FEFO
- บันทึกสินค้าหมดอายุ (Expired stock recording)
- ติดตามวันหมดอายุ manual ผ่านระบบ RKHEXP
- ระบบยืม-คืนวัสดุ (Borrow / return workflows)
- ใบขอเบิก (Requisition workflows)
- ดูยอดคงเหลือและปรับปรุงสต็อก (Stock balance and adjustment)
- รายงานและเอกสารพิมพ์ (Reports and printable documents)
- แจ้งเตือนสต็อกต่ำและสินค้าใกล้หมดอายุ (Notifications)
- เครื่องมือดูข้อมูลดิบสำหรับ admin (Database inspection)

### ข้อมูลพื้นฐาน

| รายการ | ค่า |
|---|---|
| Dev Server | `http://localhost:5173` |
| Build Output | `dist/` |
| UI Language | ภาษาไทยเป็นหลัก |
| DB | Supabase / PostgreSQL 15 |
| Hosting | Vercel (auto-deploy จาก main branch) |

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18.3.x |
| Language | TypeScript | 5.5.x |
| Build Tool | Vite | 5.4.x |
| CSS Framework | Tailwind CSS | 4.x |
| Backend / DB | Supabase (PostgreSQL 15) | JS client 2.x |
| Routing | React Router DOM | 6.x |
| Form Management | React Hook Form + Zod | 7.x / 3.x |
| Icons | Lucide React | 0.441.x |
| Date Utilities | date-fns + react-datepicker | 4.x / 9.x |
| Export | xlsx + PapaParse | — |
| Barcode / QR | html5-qrcode | 2.x |
| ID Generation | uuid | 10.x |
| Deployment | Vercel | — |

### Dependencies ที่ควรรู้

| Package | ใช้งานเพื่อ |
|---|---|
| `react-hook-form` + `zod` | form validation ทุก form |
| `lucide-react` | ไอคอนทั้งระบบ — ใช้ก่อนสร้างไอคอนเอง |
| `date-fns` | format, compare, diff วันที่ |
| `xlsx` | export รายงานเป็น Excel |
| `papaparse` | import/export CSV |
| `html5-qrcode` | สแกน QR / barcode ผ่าน camera |
| `uuid` | สร้าง UUID ฝั่ง client |
| `react-datepicker` | date picker component |
| `puppeteer` | (devDep) PDF/screenshot generation |

---

## 3. Common Commands

```bash
npm install        # ติดตั้ง dependencies
npm run dev        # รัน dev server (http://localhost:5173)
npm run build      # tsc -b && vite build
npm run preview    # preview production build
```

> ไม่มี test script ใน `package.json` ณ ขณะนี้

---

## 4. Environment Variables

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

- Supabase client singleton สร้างใน `src/lib/supabase.ts`
- **อย่า** commit real secrets ลง Git
- **อย่า** expose service-role key ในโค้ด frontend
- Production env vars ต้องตั้งค่าใน **Vercel Dashboard > Project Settings > Environment Variables**
- ไฟล์ `.env` และ `.env.local` ถูก gitignore แล้ว — อย่าแตะ

---

## 5. โครงสร้างไดเรกทอรี (Directory Structure)

```text
RKHSTOCK/
├── src/
│   ├── App.tsx                     Route definitions
│   ├── main.tsx                    React entry point
│   ├── index.css                   Global styles (Tailwind base)
│   ├── components/
│   │   ├── AppLayout.tsx           Shell layout (sidebar + navbar) — ใช้เป็น layout หลัก
│   │   ├── AuthGuard.tsx           Route protection wrapper
│   │   ├── ProductSearchInput.tsx  Shared product search autocomplete
│   │   └── ui/
│   │       ├── Alert.tsx           Alert/banner component
│   │       ├── Button.tsx          Shared button
│   │       ├── Card.tsx            Card container
│   │       ├── DatePicker.tsx      Date picker wrapper
│   │       └── Input.tsx           Input field
│   ├── features/                   Feature modules (17 features)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── stock/
│   │   ├── receive/
│   │   ├── issue/
│   │   ├── borrow/
│   │   ├── requisition/
│   │   ├── expiry_tracking/
│   │   ├── expired/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── officers/
│   │   ├── users/
│   │   ├── settings/
│   │   ├── database/
│   │   └── help/
│   ├── hooks/                      Shared React hooks
│   ├── lib/
│   │   ├── supabase.ts             Supabase client singleton
│   │   └── supabase/
│   │       └── queries.ts          Shared query helpers
│   ├── types/
│   │   └── index.ts                Global TypeScript domain types
│   └── utils/                      Pure utility functions
├── supabase/
│   ├── *.sql                       Database migrations (numbered 01–42)
│   └── functions/
│       ├── nightly-snapshot/       Scheduled nightly stock snapshot
│       └── expiry-alert/           Scheduled expiry notification function
├── public/
│   ├── fonts/                      Thai fonts
│   └── MPH.png                     Public image asset
├── agent_demo/                     Agent/orchestration demo scripts
├── index.html
├── vite.config.ts
├── vercel.json                     SPA rewrite config
└── package.json
```

---

## 6. Feature Modules (`src/features/`)

| Feature | คำอธิบาย |
|---|---|
| `auth` | การล็อกอิน / ออกจากระบบ |
| `dashboard` | หน้าหลัก / ภาพรวมสต็อก |
| `products` | จัดการสินค้า / รายการวัสดุ |
| `stock` | ดูยอดคงเหลือสต็อก / ปรับปรุงยอด / พิมพ์ป้าย |
| `receive` | รับสินค้าเข้าคลัง (Stock Receive) |
| `issue` | จ่ายสินค้าออกจากคลัง (Stock Issue) |
| `borrow` | ระบบยืม-คืนวัสดุ |
| `requisition` | ใบขอเบิก / ประวัติใบขอเบิก / พิมพ์ |
| `expiry_tracking` | ติดตามวันหมดอายุ (Lot-based FEFO / RKHEXP) |
| `expired` | บันทึกและจัดการสินค้าหมดอายุ |
| `notifications` | ระบบแจ้งเตือน (สต็อกต่ำ / ใกล้หมดอายุ) |
| `reports` | รายงานต่างๆ (Stock Card, Movements, Analysis) |
| `officers` | จัดการเจ้าหน้าที่ที่รับผิดชอบ |
| `users` | จัดการบัญชีผู้ใช้งาน |
| `settings` | ตั้งค่าระบบ / ข้อมูลองค์กร / ปีงบประมาณ |
| `database` | เครื่องมือดูข้อมูลดิบ (debug / admin) |
| `help` | หน้าช่วยเหลือ / คู่มือ keyboard shortcuts |

---

## 7. Route Map (จาก `src/App.tsx`)

### 🔓 Public
| Path | Component | หมายเหตุ |
|---|---|---|
| `/login` | `LoginPage` | หน้าล็อกอิน |

### 🔒 Protected (ครอบด้วย `AuthGuard` + `AppLayout`)
| Path | Component | หมายเหตุ |
|---|---|---|
| `/` | `Dashboard` | หน้าหลัก / ภาพรวม |
| `/requisition/new` | `RequisitionForm` | สร้างใบขอเบิกใหม่ |
| `/requisition/edit/:id` | `RequisitionForm` | แก้ไขใบขอเบิก |
| `/requisition/history` | `RequisitionHistory` | ประวัติใบขอเบิก |
| `/issue` | `IssueForm` | จ่ายสินค้าออกจากคลัง |
| `/receive` | `ReceiveForm` | รับสินค้าเข้าคลัง |
| `/expired` | `ExpiredForm` | บันทึกสินค้าหมดอายุ |
| `/expiry-tracking` | `ExpiryTrackingPage` | ติดตามวันหมดอายุ (RKHEXP) |
| `/stock` | `StockBalancePage` | ยอดคงเหลือสต็อก |
| `/stock/adjust` | `StockAdjustmentPage` | ปรับปรุงยอดสต็อก |
| `/stock/labels` | `PrintLabelPage` | พิมพ์ป้ายสินค้า |
| `/borrow` | `BorrowReturnPage` | รายการยืม-คืน |
| `/borrow/new` | `BorrowForm` | สร้างรายการยืม |
| `/borrow/return/:id` | `ReturnForm` | บันทึกการคืน |
| `/reports/stock-card` | `StockCardReport` | รายงาน Stock Card |
| `/reports/movements` | `MovementReports` | รายงานความเคลื่อนไหว |
| `/reports/print-movement` | `PrintMovement` | พิมพ์ movement |
| `/reports/negative-stock` | `NegativeStockReport` | รายงานสต็อกติดลบ |
| `/reports/negative-stock/analysis` | `NegativeStockAnalysis` | วิเคราะห์สต็อกติดลบ |
| `/reports/unfulfilled` | `UnfulfilledReport` | รายงานใบขอเบิกค้าง |
| `/reports/inventory-analysis` | `InventoryAnalysisReport` | วิเคราะห์สต็อกเพื่อสั่งซื้อ |
| `/products` | `ProductManagementPage` | จัดการสินค้า |
| `/officers` | `OfficerManagementPage` | จัดการเจ้าหน้าที่ |
| `/users` | `UserManagementPage` | จัดการผู้ใช้งาน |
| `/settings` | `SettingsPage` | ตั้งค่าระบบ |
| `/notifications` | `NotificationsPage` | การแจ้งเตือน |
| `/database` | `DatabaseManagementPage` | ดูข้อมูลดิบ (admin) |
| `/help/shortcuts` | `KeyboardShortcutsPage` | คู่มือ keyboard shortcuts |

### 🖨️ Print Routes (AuthGuard แต่ไม่มี AppLayout — พิมพ์เต็มหน้า A4)
| Path | Component |
|---|---|
| `/requisition/print/:id` | `PrintRequisition` |
| `/movement/print/:id` | `PrintMovement` |

> Route ที่ไม่ตรงกับทั้งหมดจะ redirect ไปที่ `/`

---

## 8. Shared Hooks (`src/hooks/`)

| Hook | ใช้งานเมื่อ |
|---|---|
| `useProductSearch.ts` | ค้นหาสินค้าแบบ debounced (ใช้คู่กับ `ProductSearchInput`) |
| `useWarehouses.ts` | โหลดรายการคลังสินค้าที่มีสิทธิ์เข้าถึง |
| `useOfficers.ts` | โหลดรายชื่อเจ้าหน้าที่ |
| `useIssueDraft.ts` | จัดการ draft state สำหรับ issue form (complex state) |
| `useKeyboardGridNavigator.ts` | นำทางด้วย keyboard ใน data grid / table |
| `useCellRefs.ts` | จัดการ refs ของ cell ใน grid (ใช้คู่กับ navigator) |

---

## 9. Shared Query Helpers (`src/lib/supabase/queries.ts`)

ไฟล์นี้มี shared query functions สำหรับข้อมูลที่ใช้ร่วมกันหลาย feature:

| Function | ดึงข้อมูลจากตาราง | หมายเหตุ |
|---|---|---|
| `getDefaultOfficers()` | `default_officers` | เจ้าหน้าที่ default ตาม role_key |
| `getMasterFiscalYears()` | `master_fiscal_years` | ปีงบประมาณ เรียงจากใหม่ไปเก่า |
| `getOrganizationInfo()` | `organization_info` | ข้อมูลองค์กร (1 row) |

Pattern การเรียกใช้:

```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('products')
  .select('id, generic_name, unit_id')
  .eq('is_active', true)
  .order('generic_name');

// ❌ อย่าสร้าง Supabase client ใหม่เอง
// ❌ อย่าใช้ any — ระบุ generic type เสมอ
```

---

## 10. Domain Model (จาก `src/types/index.ts`)

### Core Entities

| Type | ฟิลด์หลัก | หมายเหตุ |
|---|---|---|
| `User` | `id`, `full_name`, `role`, `officer_id` | ผู้ใช้ระบบ |
| `Officer` | `id`, `full_name`, `position`, `is_active` | เจ้าหน้าที่ผู้รับผิดชอบ movement |
| `Staff` | alias ของ `Officer` | — |
| `Product` | `id`, `generic_name`, `drug_code`, `unit_id`, flags | สินค้า / ยา / วัสดุ |
| `Unit` | `id`, `name` | หน่วยนับ |
| `Warehouse` | `id`, `name`, `is_active` | คลังสินค้า |
| `StockBalance` | `lot_id`, `current_qty`, `expiry_date` | ยอดคงเหลือรายล็อต |
| `NotificationAlert` | `message`, `alert_level`, `is_read` | การแจ้งเตือน |
| `ProductBarcode` | `barcode`, `barcode_type`, `is_primary` | one-to-many ต่อ product |

### Product Flags (boolean)

| Flag | ความหมาย |
|---|---|
| `is_psycho_narco` | ยาเสพติด / ยาจิตประสาท |
| `is_high_alert` | High Alert Drug |
| `is_cold_storage` | ต้องเก็บในตู้เย็น |

### BarcodeType

```typescript
type BarcodeType = 'EAN13' | 'Code128' | 'QR' | 'GS1-128' | 'DataMatrix' | 'Other';
```

### Workflow Entities

| Type | ฟิลด์สำคัญ | หมายเหตุ |
|---|---|---|
| `Borrowing` | `borrowed_qty`, `returned_qty`, `status` | `PENDING \| PARTIAL \| COMPLETED` |
| `ManualExpiration` | `lot_number`, `expiry_date`, `qty` | ระบบ RKHEXP |

### Settings Entities

| Type | ใช้งาน |
|---|---|
| `OrganizationInfo` | ข้อมูลองค์กร, ค่า default เช่น `safety_stock_months`, `expiry_warning_months` |
| `FiscalYear` | ปีงบประมาณ |
| `Department` | แผนก |
| `OfficerPosition` | ตำแหน่งเจ้าหน้าที่ |
| `DefaultOfficer` | เจ้าหน้าที่ default ตาม `role_key` |
| `DosageForm` | รูปแบบยา (ภาษาไทย + อังกฤษ + abbreviation) |
| `ProductType` | ประเภทสินค้า |

---

## 11. Business Logic สำคัญ

### ระบบ FEFO (First Expired, First Out)

- สต็อกแบ่งเป็น **Lot** มีวันหมดอายุ (ตาราง `lots`)
- เมื่อ issue / deduct ระบบตัดสต็อกจาก lot ที่หมดอายุเร็วที่สุดก่อน
- ดำเนินการผ่าน RPC `deduct_stock(...)` เท่านั้น — **ห้ามตัดสต็อกโดยตรง**

### Stock Balance Update

- `stock_balances` ถูกอัปเดตโดย **database trigger อัตโนมัติ** เมื่อมี movement
- **ห้าม** `UPDATE stock_balances` โดยตรงจาก frontend code
- หากต้องการปรับยอด ใช้หน้า `/stock/adjust` หรือเพิ่ม migration SQL

### Void System

- ทุก movement สามารถ void ได้ผ่าน RPC `void_stock_movement(...)`
- การ void จะ **reverse สต็อกกลับอัตโนมัติ** และ mark movement ว่าถูก void
- Migration: `08_add_void_system.sql`, `29_update_void_rpc.sql`

### Document Numbering

- เอกสารทุกประเภท (ใบเบิก, ใบรับ, ใบจ่าย) มีเลขที่เอกสารอัตโนมัติ
- Logic กำหนดใน `14_document_numbering_system.sql`

### ระบบแจ้งเตือน

- **สต็อกต่ำ**: เมื่อ current_qty ต่ำกว่า `reorder_point` ของสินค้า
- **ใกล้หมดอายุ**: เมื่อ lot มี expiry_date ภายใน `expiry_warning_months` (ตาม org settings)
- Notification ถูก generate ผ่าน Supabase Edge Function `expiry-alert`

### Inventory Analysis

- ระบบวิเคราะห์สต็อกเพื่อสนับสนุนการสั่งซื้อ
- คำนวณผ่าน RPC `get_inventory_analysis(...)` และ `get_usage_rate(...)`

---

## 12. Database / Supabase Architecture

### Key Tables

| Table | หมายเหตุ |
|---|---|
| `stock_balances` | ยอดคงเหลือ — **อัปเดตผ่าน trigger เท่านั้น ห้ามแก้ตรง** |
| `stock_movements` / `stock_movement_items` | header + line items ของ receive/issue/void |
| `lots` | ข้อมูล lot และวันหมดอายุ สำหรับ FEFO |
| `products` | ข้อมูลสินค้า (generic_name, drug_code, unit, flags) |
| `product_barcodes` | บาร์โค้ด (one-to-many ต่อ product) |
| `requisitions` / `requisition_items` | ใบขอเบิก |
| `borrows` | ระบบยืม-คืน |
| `manual_expirations` | บันทึกวันหมดอายุแบบ manual (RKHEXP) |
| `officers` | เจ้าหน้าที่ผู้รับผิดชอบ |
| `default_officers` | เจ้าหน้าที่ default ตาม role_key |
| `master_warehouses` | คลังสินค้า |
| `master_fiscal_years` | ปีงบประมาณ |
| `organization_info` | ข้อมูลองค์กร (1 row) |

### Key RPC Functions

| Function | ใช้งาน |
|---|---|
| `deduct_stock(...)` | หักสต็อก (FEFO) เมื่อ issue |
| `void_stock_movement(...)` | ยกเลิก movement พร้อม reverse สต็อก |
| `get_usage_rate(...)` | คำนวณอัตราการใช้เฉลี่ย |
| `get_inventory_analysis(...)` | วิเคราะห์สต็อกเพื่อการสั่งซื้อ |
| `get_active_product_ids(...)` | ดึง products ที่ยังใช้งานอยู่ |

> ⚠️ **อย่าแก้ไข RPC functions โดยตรงใน code** — ให้เพิ่ม migration SQL ใหม่แทนเสมอ

### Supabase Edge Functions

| Function | ทำงานอะไร |
|---|---|
| `nightly-snapshot` | Scheduled nightly stock snapshot |
| `expiry-alert` | Scheduled expiry notification generation |

> ตรวจสอบโค้ดใน `supabase/functions/` ก่อนเปลี่ยน behavior ของ notification หรือ snapshot

---

## 13. Migration Files (`supabase/`)

ไฟล์ migration ล่าสุด: **`42_fix_get_usage_rate_abs_qty.sql`**

> ไฟล์ใหม่ถัดไปควรใช้ prefix **`43_`**

### ไฟล์ที่ต้องอ่านก่อนแก้ไข stock logic

| ไฟล์ | เนื้อหา |
|---|---|
| `25_recalculate_stock_balances.sql` | Logic คำนวณยอดคงเหลือ |
| `26_fix_fefo_stock.sql` | FEFO deduction logic |
| `29_update_void_rpc.sql` | void movement RPC |
| `30_update_deduct_rpc.sql` | deduct stock RPC |
| `34_add_get_inventory_analysis.sql` | inventory analysis RPC |
| `36_fix_audit_trigger.sql` | audit log trigger |
| `42_fix_get_usage_rate_abs_qty.sql` | usage rate calculation fix |

### กฎการเพิ่ม Migration

- ใช้เลข prefix ถัดไปเสมอ (เช่น `43_`, `44_`)
- ไฟล์ไม่มีเลขนำหน้า (เช่น `fix_users_rls.sql`) คือ one-off fix
- **ห้ามลบหรือ rename migration files ที่มีอยู่**
- ระวัง RLS, triggers, RPC functions และ stock-balance logic

---

## 14. Deployment

```json
// vercel.json — SPA rewrite ทุก route ไปที่ index.html
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

| รายการ | ค่า |
|---|---|
| Platform | Vercel |
| Trigger | Auto-deploy เมื่อ push ไปยัง main branch |
| Build command | `tsc -b && vite build` |
| Output directory | `dist/` |
| SPA routing | รองรับแล้วผ่าน `vercel.json` |
| Env vars | ตั้งค่าใน Vercel Dashboard — ไม่เก็บใน tracked files |

---

## 15. Frontend Implementation Guidance

ระบบนี้คือ **operational internal app** ไม่ใช่ marketing site

### แนวทางที่ถูกต้อง

- Layout หนาแน่นแต่อ่านง่าย (dense but readable)
- ตารางและ form ชัดเจน
- นำทางได้คาดเดา (predictable navigation)
- รองรับการพิมพ์ด้วย keyboard (keyboard-friendly data entry)
- ใช้ shared components และ hooks ที่มีอยู่
- วาง feature-specific pages ใน `src/features/<feature>/`
- วาง reusable UI ใน `src/components/ui/` เฉพาะเมื่อใช้ร่วมกันจริง
- ใช้ `lucide-react` สำหรับไอคอน
- ป้องกัน double-submit ด้วย `isSubmitting` state

### สิ่งที่ควรหลีกเลี่ยง

- Pattern ของ landing page / marketing site
- Large hero section สำหรับหน้าใช้งานภายใน
- Visual restyling ที่ไม่เกี่ยวข้องกับ task
- Broad rewrite ขณะแก้ bug เฉพาะจุด

---

## 16. Agent Checklist

### ก่อนแก้ไข

- [ ] อ่านไฟล์ feature ที่เกี่ยวข้อง
- [ ] ตรวจ `src/types/index.ts` เมื่อแตะ domain data
- [ ] ตรวจ `src/lib/supabase/queries.ts` ก่อนเพิ่ม query ใหม่
- [ ] ตรวจ migration SQL ที่เกี่ยวข้อง ก่อนเปลี่ยน stock / lot / movement / void / audit behavior

### ขณะแก้ไข

- [ ] Scope การเปลี่ยนแปลงให้แคบ
- [ ] ไม่ overwrite ไฟล์ที่ไม่เกี่ยวข้อง
- [ ] ไม่ commit secrets
- [ ] ไม่ mutate database โดยตรง — ผ่าน RPC / trigger เสมอ
- [ ] ไม่เปลี่ยนภาษาไทย UI โดยไม่ได้รับคำสั่ง

### ก่อนส่งมอบ

- [ ] รัน `npm run build` เมื่อเป็นไปได้
- [ ] แจ้งหากมีการตรวจสอบที่รันไม่ได้
- [ ] สรุปไฟล์ที่เปลี่ยน และ behavior ที่เปลี่ยนแปลงสำคัญ

---

## 17. สิ่งที่ห้ามทำ (Strict Rules)

| ห้าม | เหตุผล |
|---|---|
| แก้ `stock_balances` โดยตรง | ต้องผ่าน trigger / RPC เท่านั้น |
| เพิ่ม `VITE_SUPABASE_SERVICE_ROLE_KEY` ใน tracked files | Security — ห้าม expose service key |
| ลบหรือ rename migration files | อาจทำให้ DB state เสียหาย |
| แตะ `.env` และ `.env.local` | Local secrets — gitignored |
| แก้ RPC functions โดยตรงใน code | ต้องเพิ่ม migration SQL ใหม่แทน |
| Revert user changes โดยไม่ได้รับคำสั่ง | Agent safety |
| Rewrite ไฟล์ที่ไม่เกี่ยวข้อง | Agent safety |
| Destructive git / filesystem operations | Agent safety |
