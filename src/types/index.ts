export interface User {
  id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  full_name: string;
  role: string;
  officer_id?: string;
  email?: string;
}

export interface Officer {
  id: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  position?: string;
  email?: string;
  is_active?: boolean;
}

export type Staff = Officer;


export interface Unit {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  drug_code?: string | null;
  generic_name: string;
  abbreviation?: string | null;
  is_active?: boolean;
  unit_id?: string | null;
  unit?: Unit | null;
  reorder_point?: number;
  dosage_form_id?: string | null;
  pack_size?: number;
  product_type_id?: string | null;
  unit_price?: number;
  is_psycho_narco?: boolean;
  is_high_alert?: boolean;
  is_cold_storage?: boolean;
}

export interface ProductSearchResult extends Product {
  unit_id?: any; // To support Supabase join like unit_id(name)
}

// ---------------------------------------------------------
// Barcode System (One-to-Many)
// ---------------------------------------------------------
export type BarcodeType = 'EAN13' | 'Code128' | 'QR' | 'GS1-128' | 'DataMatrix' | 'Other';

export interface ProductBarcode {
  id: string;
  product_id: string;
  barcode: string;
  brand_name?: string | null;
  barcode_type?: BarcodeType | null;
  is_primary?: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface StockBalance {
  id?: string;
  lot_id?: string;
  lot_number: string;
  expiry_date: string;
  current_qty: number;
  product_id?: string;
  warehouse_id?: string;
  unit_price?: number;
  products?: any;
}

export interface NotificationAlert {
  id: string;
  message: string;
  alert_level: string;
  is_read: boolean;
  created_at: string;
  days_remaining?: number;
  lot_number?: string;
  expiry_date?: string;
  product_id?: string;
  products?: any;
}

// ---------------------------------------------------------
// Settings & Organization Types
// ---------------------------------------------------------

export interface OrganizationInfo {
  id: string;
  org_name: string;
  address_no?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  phone?: string;
  fax?: string;
  requisition_avg_months?: number;
  safety_stock_months?: number;
  expiry_warning_months?: number;
  updated_at?: string;
}

export interface FiscalYear {
  id: string;
  year_name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  created_at?: string;
}

export interface OfficerPosition {
  id: string;
  name: string;
  created_at?: string;
}

export interface DefaultOfficer {
  role_key: string;
  user_id?: string;
  updated_at?: string;
}

export interface DosageForm {
  id: string;
  name_en: string;
  name_th: string;
  abbreviation?: string;
  main_category?: string;
  created_at?: string;
}

export interface ProductType {
  id: string;
  name: string;
  created_at?: string;
}

// ---------------------------------------------------------
// Borrow & Return Types
// ---------------------------------------------------------

export interface Borrowing {
  id: string;
  product_id: string;
  borrower_id: string;
  warehouse_id?: string;
  borrowed_qty: number;
  returned_qty: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  note?: string;
  created_at?: string;
  updated_at?: string;
  
  // Relations (joined data)
  products?: Product;
  officers?: Officer;
  master_warehouses?: Warehouse;
}

// ---------------------------------------------------------
// Expiry Tracking System (RKHEXP)
// ---------------------------------------------------------
export interface ManualExpiration {
  id: string;
  product_id: string;
  lot_number?: string;
  expiry_date: string;
  qty?: number;
  warehouse_id?: string;
  manufacturer?: string;
  remark?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // Relations
  products?: Product;
  master_warehouses?: Warehouse;
}
