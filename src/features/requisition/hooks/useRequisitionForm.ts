import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { getDefaultOfficers, getOrganizationInfo } from '@/lib/supabase/queries';
import { useNavigate } from 'react-router-dom';
import { useKeyboardGridNavigator } from '@/hooks/useKeyboardGridNavigator';
import * as XLSX from 'xlsx';
import { useIssueDraft, formatDraftTimestamp, IssueDraftPayload, DraftRecord } from '@/hooks/useIssueDraft';

// ==========================================

export interface MasterUnit {
  name?: string;
  unit_name?: string;
}

export interface MasterDosageForm {
  name_en?: string;
  abbreviation?: string;
}

export interface ProductResult {
  id: string;
  drug_code?: string;
  generic_name: string;
  abbreviation?: string;
  pack_size?: number;
  manual_monthly_usage?: number;
  is_psycho_narco?: boolean;
  is_high_alert?: boolean;
  is_cold_storage?: boolean;
  master_units?: MasterUnit | MasterUnit[];
  master_dosage_forms?: MasterDosageForm | MasterDosageForm[];
  stock_balances?: { current_qty: number }[];
}

export interface ImportDocHeader {
  doc_no: string;
  doc_date: string;
  fiscal_year: string;
  requester: string;
  approver: string;
  status: string;
  remarks: string;
}

export interface ImportItem {
  rowNum: number;
  status: 'ready' | 'not_found';
  product_id?: string;
  product_name: string;
  drug_code: string;
  pack_size?: number;
  unit_name?: string;
  qty: number;
  is_manual_rate?: boolean;
  months?: number;
  suggested_qty?: number;
  avg_monthly_usage?: number;
  manual_monthly_usage?: number;
  usage_rate?: number;
  is_psycho_narco?: boolean;
  is_high_alert?: boolean;
  is_cold_storage?: boolean;
  substock_qty?: number;
  remarks?: string;
  abbreviation?: string;
  errorMessage?: string;
  dosage_form_name?: string;
}

export interface MultiImportBlock {
  blockIndex: number;
  sheetName?: string;
  docHeader: ImportDocHeader;
  items: ImportItem[];
  matchedRequesterId: string | null;
  matchedApproverId: string | null;
  errors: string[];
}

export interface ImportResult {
  doc_no: string;
  count: number;
}

export interface OfficerInfo {
  id: string;
  full_name: string;
  position?: string;
  user_id?: string;
  role_key?: string;
}

// 1. Zod Schema & Validation
// ==========================================
const itemSchema = z.object({
  product_id: z.string().uuid("กรุณาเลือกเวชภัณฑ์"),
  product_name: z.string().min(1, "กรุณาเลือกเวชภัณฑ์"),
  qty: z.number().min(1, "จำนวนเบิกต้องมากกว่า 0"),
  pack_size: z.number().default(1),
  is_manual_rate: z.boolean().default(false),
  months: z.number().default(6),
  suggested_qty: z.number().default(0),
  avg_monthly_usage: z.number().default(0),
  manual_monthly_usage: z.number().default(0),
  usage_rate: z.number().default(0),
  drug_code: z.string().optional().nullable(),
  is_psycho_narco: z.boolean().optional().nullable(),
  is_high_alert: z.boolean().optional().nullable(),
  is_cold_storage: z.boolean().optional().nullable(),
  substock_qty: z.number().default(0),
  remarks: z.string().optional(),
  unit_name: z.string().optional().nullable(),
  abbreviation: z.string().optional().nullable(),
  dosage_form_name: z.string().optional().nullable(),
});

export const formSchema = z.object({
  doc_date: z.string().min(1, "กรุณาเลือกวันที่"),
  requester_id: z.string().uuid("กรุณาเลือกผู้เบิก"),
  approver_id: z.string().uuid("กรุณาเลือกผู้อนุมัติจ่าย"),
  remarks: z.string().optional(),
  items: z.array(itemSchema)
    .min(1, "ต้องมีอย่างน้อย 1 รายการ")
    .refine((items) => {
      const productIds = items.map((i) => i.product_id).filter(Boolean);
      return new Set(productIds).size === productIds.length;
    }, { message: "ห้ามเลือกเวชภัณฑ์ซ้ำในใบเดียวกัน" }),
});

export type FormValues = z.infer<typeof formSchema>;

// Utility to safely parse dates from Excel imports (including serial numbers like 45860)
function parseExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === '') {
    return new Date().toISOString().split('T')[0];
  }

  // If already a JS Date object
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }

  // If it's a number (or a string representing a number, e.g. "45860")
  const num = Number(val);
  if (!isNaN(num) && num > 25569 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // If it's a string representing date
  const str = String(val).trim();
  if (str) {
    const parts = str.split(/[/\-.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      if (parts[2].length === 4) {
        let year = parseInt(parts[2], 10);
        if (year > 2400) {
          year -= 543;
        }
        return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

const getUnitName = (unit: MasterUnit | MasterUnit[] | undefined): string => {
  if (!unit) return '';
  const first = Array.isArray(unit) ? unit[0] : unit;
  return first?.unit_name || first?.name || '';
};

const getDosageFormName = (df: MasterDosageForm | MasterDosageForm[] | undefined): string => {
  if (!df) return '';
  const first = Array.isArray(df) ? df[0] : df;
  return first?.abbreviation || first?.name_en || '';
};

export function useRequisitionForm(id: string | undefined, officers: OfficerInfo[]) {
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [editDocNo, setEditDocNo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [systemAgeInDays, setSystemAgeInDays] = useState<number | null>(null);
  const [globalMonths, setGlobalMonths] = useState<number>(6);
  const [safetyStockMonths, setSafetyStockMonths] = useState<number>(1);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState<number>(-1);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState<boolean>(false);

  // Sort state for items table
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'dosage_form' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'preview' | 'success'>('upload');
  const [importMode, setImportMode] = useState<'single' | 'multi'>('single');
  const [singleImportItems, setSingleImportItems] = useState<ImportItem[]>([]);
  const [multiImportBlocks, setMultiImportBlocks] = useState<MultiImportBlock[]>([]);
  const [activePreviewBlockIndex, setActivePreviewBlockIndex] = useState<number>(0);
  const [importDocHeader, setImportDocHeader] = useState<ImportDocHeader | null>(null);
  const [importError, setImportError] = useState('');
  const [importResultList, setImportResultList] = useState<ImportResult[]>([]);

  const importFileRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ─── Draft state ───────────────────────────────────────────────────────
  // Store userId in a ref so draft hook key is stable even before auth returns.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id ?? null));
  }, []);

  // Use a per-feature key prefix so requisition drafts don’t collide with issue drafts.
  // We achieve this by wrapping the shared hook with a userId suffix — the hook itself
  // stores key = `issue_draft_{userId}` so we pass a synthetic userId per-feature.
  const reqUserId = currentUserId ? `req_${currentUserId}` : null;
  const { scheduleSave, loadDraft, clearDraft } = useIssueDraft({ userId: reqUserId });

  const [pendingDraft, setPendingDraft] = useState<{ savedAt: string; payload: IssueDraftPayload } | null>(null);
  const draftCheckedRef = useRef(false);

  // Check for existing draft once (only create mode, not edit mode)
  useEffect(() => {
    if (isEditMode) return;
    if (!currentUserId) return;
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    loadDraft().then((record: DraftRecord | null) => {
      if (record) {
        console.debug('[ReqDraft] Found draft:', record.savedAt);
        setPendingDraft({ savedAt: record.savedAt, payload: record.payload });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isEditMode]);

  // Expose restore/discard handlers so RequisitionForm.tsx can wire them to the banner
  const handleRestoreReqDraft = (resetFn: (v: any) => void) => {
    if (!pendingDraft) return;
    const p = pendingDraft.payload;
    // payload.rows contains serialised FormValues.items
    if (Array.isArray(p.rows) && p.rows.length > 0) {
      resetFn({
        doc_date: p.docDate || new Date().toISOString().split('T')[0],
        requester_id: p.actorId || '',
        approver_id: p.warehouseId || '', // re-purposed field
        remarks: p.headerNote || '',
        items: (p.rows as any[]).filter(r => r.product_id),
      });
    }
    setPendingDraft(null);
  };

  const handleDiscardReqDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  // format helper re-exported for use in the banner
  const formatReqDraftTimestamp = formatDraftTimestamp;

  // Auto close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setActiveSearchRowIndex(null);
        setProductSearch('');
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set focus on input search when active search changes
  useEffect(() => {
    if (activeSearchRowIndex !== null) {
      setTimeout(() => {
        const input = document.getElementById(`search-input-${activeSearchRowIndex}`);
        input?.focus();
      }, 50);
    }
  }, [activeSearchRowIndex]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      doc_date: new Date().toISOString().split('T')[0],
      requester_id: '',
      approver_id: '',
      remarks: '',
      items: [
        {
          product_id: '',
          product_name: '',
          qty: 0,
          pack_size: 1,
          is_manual_rate: false,
          months: 6,
          suggested_qty: 0,
          avg_monthly_usage: 0,
          manual_monthly_usage: 0,
          usage_rate: 0,
          drug_code: '',
          is_psycho_narco: false,
          is_high_alert: false,
          is_cold_storage: false,
          substock_qty: 0,
          remarks: '',
          abbreviation: '',
        },
      ],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');

  // ─── Auto-save to IndexedDB on every form change ─────────────────────────────
  const watchAll = watch();
  useEffect(() => {
    if (!currentUserId || isEditMode) return;
    const hasData = watchAll.items?.some(r => r.product_id);
    if (!hasData) return;
    const payload: IssueDraftPayload = {
      // Re-purpose fields: actorId = requester_id, warehouseId = approver_id
      warehouseId: watchAll.approver_id || '',
      toWarehouseId: '',
      actorId: watchAll.requester_id || '',
      docDate: watchAll.doc_date || '',
      headerNote: watchAll.remarks || '',
      rows: watchAll.items || [],
    };
    scheduleSave(payload);
  }, [watchAll, currentUserId, isEditMode, scheduleSave]);

  useKeyboardGridNavigator({
    rowCount: fields.length,
    colCount: 3, // Col 0: Drug Search, Col 1: Qty, Col 2: Remarks
    onAddRow: () => {
      append({
        product_id: '',
        product_name: '',
        qty: 0,
        pack_size: 1,
        is_manual_rate: false,
        months: globalMonths,
        suggested_qty: 0,
        avg_monthly_usage: 0,
        manual_monthly_usage: 0,
        usage_rate: 0,
        drug_code: '',
        is_psycho_narco: false,
        is_high_alert: false,
        is_cold_storage: false,
        substock_qty: 0,
        remarks: '',
        abbreviation: '',
      });
      setTimeout(() => {
        const newRowIndex = fields.length;
        const newSearchInput = document.getElementById(`search-input-${newRowIndex}`) || document.querySelector(`[data-row="${newRowIndex}"][data-col="0"]`);
        (newSearchInput as HTMLInputElement)?.focus();
      }, 100);
    }
  });

  // Load existing data if edit mode
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!isEditMode) return;
      
      try {
        setIsLoadingAll(true);
        // Fetch Requisition Header
        const { data: headerData, error: headerError } = await supabase
          .from('requisitions')
          .select('*')
          .eq('id', id)
          .single();
          
        if (headerError) throw headerError;
        if (headerData) setEditDocNo(headerData.doc_no);
        
        // Fetch Items
        const { data: itemsData, error: itemsError } = await supabase
          .from('requisition_items')
          .select(`
            id, qty, pack_size, unit_name, remarks, substock_qty, usage_rate, product_id,
            product:products (
              drug_code, generic_name, abbreviation, is_psycho_narco, is_high_alert, is_cold_storage,
              manual_monthly_usage,
              master_dosage_forms(name_en, abbreviation)
            )
          `)
          .eq('requisition_id', id);
          
        if (itemsError) throw itemsError;

        // Map and reset
        if (headerData) {
          const formattedItems = await Promise.all((itemsData || []).map(async (item) => {
            const product = (item.product as unknown as ProductResult);
            const productId = item.product_id;
            const months = globalMonths;
            
            let avgUsage = 0;
            try {
              if (productId) {
                const { data: usageData } = await supabase.rpc('get_usage_rate', {
                  p_product_id: productId,
                  p_months: months,
                });
                if (usageData && usageData[0]) {
                  avgUsage = Math.ceil(usageData[0].avg_monthly_usage || 0);
                }
              }
            } catch (err) {
              console.error('Error fetching usage rate for product on load:', err);
            }

            const manualUsage = product?.manual_monthly_usage ?? 0;
            const savedUsageRate = item.usage_rate ?? 0;
            
            // Determine whether it was a manual rate or calculated rate.
            // If the saved usage rate matches the auto-calculated average monthly usage,
            // we treat it as is_manual_rate = false (i.e. calculated rate selected).
            // Otherwise, it was manual rate (either matching product manual rate or custom rate).
            const isManual = (savedUsageRate !== avgUsage) || (savedUsageRate === manualUsage && avgUsage === manualUsage);

            return {
              product_id: item.product_id,
              product_name: product?.generic_name || '',
              qty: item.qty,
              pack_size: item.pack_size,
              is_manual_rate: isManual,
              months: months,
              suggested_qty: 0,
              avg_monthly_usage: avgUsage,
              manual_monthly_usage: manualUsage,
              usage_rate: savedUsageRate,
              drug_code: product?.drug_code || '',
              is_psycho_narco: product?.is_psycho_narco || false,
              is_high_alert: product?.is_high_alert || false,
              is_cold_storage: product?.is_cold_storage || false,
              substock_qty: item.substock_qty ?? 0,
              remarks: item.remarks || '',
              abbreviation: product?.abbreviation || '',
              unit_name: item.unit_name || '',
              dosage_form_name: getDosageFormName(product?.master_dosage_forms)
            };
          }));
          
          // Sort formattedItems by dosage_form_name then COLD then HAD then product_name
          formattedItems.sort((a, b) => {
            const dfA = a.dosage_form_name || '';
            const dfB = b.dosage_form_name || '';
            if (dfA !== dfB) return dfA.localeCompare(dfB);

            const coldA = a.is_cold_storage ? 1 : 0;
            const coldB = b.is_cold_storage ? 1 : 0;
            if (coldA !== coldB) return coldB - coldA;

            const hadA = a.is_high_alert ? 1 : 0;
            const hadB = b.is_high_alert ? 1 : 0;
            if (hadA !== hadB) return hadB - hadA;

            return a.product_name.localeCompare(b.product_name);
          });
          
          reset({
            doc_date: new Date(headerData.doc_date).toISOString().split('T')[0],
            requester_id: headerData.requester_id,
            approver_id: headerData.approver_id,
            remarks: headerData.remarks || '',
            items: formattedItems.length > 0 ? formattedItems : [{
              product_id: '', product_name: '', qty: 0, pack_size: 1, is_manual_rate: false, months: globalMonths,
              suggested_qty: 0, avg_monthly_usage: 0, manual_monthly_usage: 0, usage_rate: 0,
              drug_code: '', is_psycho_narco: false, is_high_alert: false, is_cold_storage: false,
              substock_qty: 0, remarks: '', abbreviation: ''
            }]
          });
        }
      } catch (err: unknown) {
        console.error('Error fetching requisition:', err);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูลใบเบิก: ' + (err as any).message);
      } finally {
        setIsLoadingAll(false);
      }
    };
    
    fetchExistingData();
  }, [isEditMode, id, globalMonths, reset]);

  // Load settings and defaults
  useEffect(() => {
    const fetchSystemAge = async () => {
      try {
        const { data } = await supabase
          .from('stock_movements')
          .select('doc_date')
          .order('doc_date', { ascending: true })
          .limit(1);
        if (data && data[0] && data[0].doc_date) {
          const firstDate = new Date(data[0].doc_date);
          const diffTime = Math.abs(new Date().getTime() - firstDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setSystemAgeInDays(diffDays);
        } else {
          setSystemAgeInDays(0);
        }
      } catch (err) {
        console.error('Error fetching system age:', err);
        setSystemAgeInDays(0);
      }
    };

    const fetchOrgSettings = async () => {
      try {
        const orgInfo = await getOrganizationInfo();
        if (orgInfo) {
          if (orgInfo.requisition_avg_months) {
            const months = orgInfo.requisition_avg_months;
            setGlobalMonths(months);
            setValue('items.0.months', months);
          }
          if (orgInfo.safety_stock_months) {
            setSafetyStockMonths(orgInfo.safety_stock_months);
          }
        }
      } catch (err) {
        console.error('Error fetching org settings:', err);
      }
    };

    fetchSystemAge();
    fetchOrgSettings();
  }, [setValue]);

  // Load default officers (only in create mode)
  useEffect(() => {
    const loadDefaultOfficers = async () => {
      if (isEditMode) return;
      try {
        const data = await getDefaultOfficers();
        if (data) {
          const req = data.find(o => o.role_key === 'requester');
          const app = data.find(o => o.role_key === 'approver_main_warehouse');
          if (req && req.user_id) setValue('requester_id', req.user_id);
          if (app && app.user_id) setValue('approver_id', app.user_id);
        }
      } catch (err) {
        console.error('Error loading default officers:', err);
      }
    };
    if (officers.length > 0) {
      loadDefaultOfficers();
    }
  }, [officers, setValue, isEditMode]);

  // Fuzzy product search query
  useEffect(() => {
    const fetchProducts = setTimeout(async () => {
      if (activeSearchRowIndex === null) {
        setSearchResults([]);
        return;
      }
      let query = supabase
        .from('products')
        .select(`
          id, 
          drug_code, 
          generic_name, 
          abbreviation, 
          pack_size, 
          manual_monthly_usage, 
          is_psycho_narco, 
          is_high_alert, 
          is_cold_storage, 
          master_units(name:unit_name),
          master_dosage_forms(name_en, abbreviation)
        `)
        .eq('is_active', true);

      if (productSearch.trim().length > 0) {
        query = query.or(`generic_name.ilike.%${productSearch}%,abbreviation.ilike.%${productSearch}%,drug_code.ilike.%${productSearch}%`);
      }
      const { data } = await query.order('generic_name').limit(100);
      if (data) setSearchResults(data);
    }, 150);

    return () => clearTimeout(fetchProducts);
  }, [productSearch, activeSearchRowIndex]);

  const handleSelectProduct = async (index: number, product: ProductResult) => {
    setIsLoadingAll(true);
    const manualUsage = product.manual_monthly_usage || 0;
    
    // Fetch substock qty (total stock balances)
    let currentQty = 0;
    try {
      const { data } = await supabase
        .from('stock_balances')
        .select('current_qty')
        .eq('product_id', product.id);
      currentQty = data?.reduce((acc, curr) => acc + (curr.current_qty || 0), 0) || 0;
    } catch (err) {
      console.error('Error fetching stock balance:', err);
    }

    const newItem = {
      ...watchItems[index],
      product_id: product.id,
      product_name: product.generic_name,
      unit_name: getUnitName(product.master_units),
      pack_size: product.pack_size || 1,
      manual_monthly_usage: manualUsage,
      drug_code: product.drug_code || '',
      is_psycho_narco: product.is_psycho_narco || false,
      is_high_alert: product.is_high_alert || false,
      is_cold_storage: product.is_cold_storage || false,
      substock_qty: currentQty,
      remarks: '',
      abbreviation: product.abbreviation || '',
      dosage_form_name: getDosageFormName(product.master_dosage_forms as any),
      is_manual_rate: false, // Default to auto input
    };

    update(index, newItem);
    setProductSearch('');
    setSearchResults([]);
    setActiveSearchRowIndex(null);
    setIsLoadingAll(false);

    setTimeout(() => {
      const qtyInput = document.querySelector(`[data-row="${index}"][data-col="1"].nav-cell`) as HTMLInputElement;
      qtyInput?.focus();
      qtyInput?.select?.();
    }, 150);

    // Call RPC to calculate suggested order qty
    await fetchAndSetUsageRate(index, product.id, newItem.months || globalMonths, manualUsage, newItem);
  };

  const fetchAndSetUsageRate = async (index: number, productId: string, months: number, manualUsageVal?: number, curItemState?: any) => {
    if (!productId) return;
    const { data } = await supabase.rpc('get_usage_rate', {
      p_product_id: productId,
      p_months: months,
    });

    const currentItem = curItemState || watchItems[index];
    const manualVal = manualUsageVal !== undefined ? manualUsageVal : (currentItem.manual_monthly_usage || 0);
    const currentStock = currentItem.substock_qty || 0;

    if (data && data[0]) {
      const result = data[0];
      // If system age is less than requested months * 30 days, we MUST enforce manual rate
      const forceManual = systemAgeInDays !== null && systemAgeInDays < (months * 30) ? true : currentItem.is_manual_rate;
      const avgUsage = Math.ceil(result.avg_monthly_usage || 0);
      const usageRate = forceManual ? manualVal : avgUsage;
      const sugQty = Math.max(0, Math.ceil(usageRate * safetyStockMonths - currentStock));

      update(index, {
        ...currentItem,
        months,
        suggested_qty: sugQty,
        avg_monthly_usage: avgUsage,
        manual_monthly_usage: manualVal,
        is_manual_rate: forceManual,
        usage_rate: usageRate,
        qty: forceManual ? Math.ceil(currentItem.qty || manualVal) : sugQty,
      });
    } else {
      const forceManual = systemAgeInDays !== null && systemAgeInDays < (months * 30) ? true : currentItem.is_manual_rate;
      const usageRate = manualVal;
      const sugQty = Math.max(0, Math.ceil(usageRate * safetyStockMonths - currentStock));
      update(index, {
        ...currentItem,
        months,
        suggested_qty: sugQty,
        avg_monthly_usage: 0,
        manual_monthly_usage: manualVal,
        is_manual_rate: forceManual,
        usage_rate: usageRate,
        qty: forceManual ? Math.ceil(currentItem.qty || manualVal) : sugQty,
      });
    }
  };

  const handleMonthsChange = (index: number, months: number) => {
    const item = watchItems[index];
    if (item.product_id) {
      fetchAndSetUsageRate(index, item.product_id, months);
    }
  };

  const handleAutoAdjustQty = (index: number, multiplier: number) => {
    const item = watchItems[index];
    if (!item) return;
    const currentStock = item.substock_qty || 0;
    // เติมเต็มสต๊อก: คำนวณจำนวนที่ต้องเบิกเพิ่ม เพื่อให้สต๊อกรวมเท่ากับเป้าหมาย (multiplier)
    const targetQty = Math.max(0, Math.ceil(multiplier - currentStock));
    const targetSug = targetQty;
    setValue(`items.${index}.qty`, targetQty, { shouldValidate: true });
    setValue(`items.${index}.suggested_qty`, targetSug, { shouldValidate: true });
  };

  const handleAddAllActiveProducts = async () => {
    setIsLoadingAll(true);
    try {
      const { data: activeProducts } = await supabase
        .from('products')
        .select(`
          id, 
          drug_code, 
          generic_name, 
          abbreviation,
          pack_size, 
          manual_monthly_usage, 
          is_psycho_narco, 
          is_high_alert, 
          is_cold_storage, 
          master_units(name:unit_name),
          master_dosage_forms(name_en, abbreviation),
          stock_balances(current_qty)
        `)
        .eq('is_active', true)
        .order('generic_name');

      if (activeProducts && activeProducts.length > 0) {
        const forceManualGlobal = !(systemAgeInDays !== null && systemAgeInDays >= 90);
        const months = globalMonths;

        const list = await Promise.all(activeProducts.map(async (p) => {
          const totalQty = p.stock_balances?.reduce((sum: number, b: any) => sum + (b.current_qty || 0), 0) || 0;
          const manualUsage = p.manual_monthly_usage || 0;
          
          let avgUsage = 0;
          try {
            const { data } = await supabase.rpc('get_usage_rate', {
              p_product_id: p.id,
              p_months: months,
            });
            if (data && data[0]) {
              avgUsage = Math.ceil(data[0].avg_monthly_usage || 0);
            }
          } catch (err) {
            console.error(`Error fetching usage rate for ${p.id}:`, err);
          }

          const forceManual = systemAgeInDays !== null && systemAgeInDays < (months * 30) ? true : forceManualGlobal;
          const usageRate = forceManual ? manualUsage : avgUsage;
          const sugQty = Math.max(0, Math.ceil(usageRate * safetyStockMonths - totalQty));

          return {
            product_id: p.id,
            product_name: p.generic_name,
            qty: forceManual ? Math.ceil(manualUsage) : sugQty,
            unit_name: getUnitName(p.master_units as any),
            pack_size: p.pack_size || 1,
            is_manual_rate: forceManual,
            months,
            suggested_qty: sugQty,
            avg_monthly_usage: avgUsage,
            manual_monthly_usage: manualUsage,
            usage_rate: usageRate,
            drug_code: p.drug_code || '',
            is_psycho_narco: p.is_psycho_narco || false,
            is_high_alert: p.is_high_alert || false,
            is_cold_storage: p.is_cold_storage || false,
            substock_qty: totalQty,
            remarks: '',
            abbreviation: p.abbreviation || '',
            dosage_form_name: getDosageFormName(p.master_dosage_forms as any),
          };
        }));

        // Sort the list by dosage_form_name then COLD then HAD then product_name
        list.sort((a, b) => {
          const dfA = a.dosage_form_name || '';
          const dfB = b.dosage_form_name || '';
          if (dfA !== dfB) return dfA.localeCompare(dfB);

          const coldA = a.is_cold_storage ? 1 : 0;
          const coldB = b.is_cold_storage ? 1 : 0;
          if (coldA !== coldB) return coldB - coldA;

          const hadA = a.is_high_alert ? 1 : 0;
          const hadB = b.is_high_alert ? 1 : 0;
          if (hadA !== hadB) return hadB - hadA;

          return a.product_name.localeCompare(b.product_name);
        });

        setValue('items', list, { shouldValidate: true });
      }
    } catch (err) {
      console.error('Error loading all products:', err);
      alert('เกิดข้อผิดพลาดในการดึงรายการเวชภัณฑ์');
    } finally {
      setIsLoadingAll(false);
    }
  };

  // ==========================================
  // 3. Excel Templates Download
  // ==========================================
  const TEMPLATE_HEADERS = [
    'doc_no', 'doc_date', 'fiscal_year', 'requester', 'approver', 'status', 'remarks'
  ];
  
  const REQ_START = '[req_start]';
  const ITEMS_HEADER = '[items]';
  const REQ_END = '[req_end]';

  const downloadStandardTemplate = () => {
    const wb = XLSX.utils.book_new();
    const todayStr = new Date().toISOString().split('T')[0];
    const thFiscalYear = new Date().getFullYear() + 543;

    const makeSheetData = (docNo: string, reqName: string, appName: string, drugItems: any[]) => {
      const rows = [
        ['field', 'value', '', 'คำอธิบาย'],
        ['doc_no', docNo, '', 'เลขที่เอกสารขอเบิก (ห้ามซ้ำ)'],
        ['doc_date', todayStr, '', 'วันที่ขอเบิก (YYYY-MM-DD)'],
        ['fiscal_year', thFiscalYear, '', 'ปีงบประมาณ พ.ศ. (เช่น 2569)'],
        ['requester', reqName, '', 'ชื่อ-นามสกุล ผู้เบิก (ในระบบ)'],
        ['approver', appName, '', 'ชื่อ-นามสกุล ผู้อนุมัติจ่าย (ในระบบ)'],
        ['remarks', '', '', 'หมายเหตุ (ถ้ามี)'],
        [], // Empty row
        ['drug_code', 'substock_qty', 'usage_rate', 'qty', 'remarks'], // items header
        ...drugItems
      ];
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 30 }];
      return sheet;
    };

    XLSX.utils.book_append_sheet(wb, makeSheetData('REQ-001', 'ผู้เบิกทดสอบ 1', 'ผู้อนุมัติทดสอบ 1', [
      ['DRUG-001', 50, 15, 10, 'เบิกด่วนประจำสัปดาห์'],
      ['DRUG-002', 20, 8, 5, '']
    ]), 'REQ-001');

    XLSX.utils.book_append_sheet(wb, makeSheetData('REQ-002', 'ผู้เบิกทดสอบ 2', 'ผู้อนุมัติทดสอบ 2', [
      ['DRUG-003', 30, 10, 8, ''],
      ['DRUG-004', 10, 5, 3, '']
    ]), 'REQ-002');

    // Instructions sheet
    const instruct = [
      ['📋 วิธีใช้งานไฟล์ Template นี้'],
      [],
      ['วิธีที่ 1: หลายใบเบิก (แนะนำ — แต่ละ Sheet = ใบเบิก 1 ใบ)'],
      ['→ เพิ่ม Sheet ใหม่สำหรับแต่ละใบเบิก ตั้งชื่อ Sheet ตามใจชอบ'],
      ['→ ทุก Sheet ต้องมีโครงสร้างเหมือน Sheet REQ-001 และ REQ-002'],
      ['→ ระบบจะอ่านทุก Sheet และสร้างใบเบิกแยกกันในระบบอัตโนมัติ'],
      [],
      ['วิธีที่ 2: หลายใบเบิกในไฟล์ Sheet เดียว (Multi-Block)'],
      ['→ สามารถดาวน์โหลด Template แบบ CSV เพื่อดูรูปแบบ Multi-Block ได้'],
      [],
      ['คอลัมน์รายการยา:'],
      ['  drug_code    — รหัสยา/เวชภัณฑ์ในระบบ (เช่น CPU001 หรือ DRUG-001)'],
      ['  substock_qty — ยอดคงคลังเดิมย่อย ณ ปัจจุบัน (ระบุเป็นตัวเลข)'],
      ['  usage_rate   — อัตราการใช้ยาต่อเดือน (ระบุเป็นตัวเลข)'],
      ['  qty          — จำนวนที่ต้องการเบิกจริง (ระบุเป็นตัวเลข)'],
      ['  remarks      — หมายเหตุรายการบรรทัดนั้นๆ']
    ];
    const instructSheet = XLSX.utils.aoa_to_sheet(instruct);
    instructSheet['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, instructSheet, '📋 คำอธิบาย');

    XLSX.writeFile(wb, 'RKHSTOCK_Requisition_Import_Template.xlsx');
  };

  const downloadRelationalTemplate = () => {
    const wb = XLSX.utils.book_new();
    const todayStr = new Date().toISOString().split('T')[0];
    const thFiscalYear = new Date().getFullYear() + 543;

    // Headers sheet
    const headersRows = [
      ['doc_no', 'doc_date', 'fiscal_year', 'requester', 'approver', 'remarks', 'status'],
      ['REQ-001', todayStr, thFiscalYear, 'ผู้เบิกทดสอบ 1', 'ผู้อนุมัติทดสอบ 1', 'เบิกใช้สำหรับตึกอายุรกรรม', 'draft'],
      ['REQ-002', todayStr, thFiscalYear, 'ผู้เบิกทดสอบ 2', 'ผู้อนุมัติทดสอบ 2', 'เบิกด่วนแผนกฉุกเฉิน', 'draft']
    ];
    const headersSheet = XLSX.utils.aoa_to_sheet(headersRows);
    headersSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, headersSheet, 'ใบเบิก (Headers)');

    // Items sheet
    const itemsRows = [
      ['doc_no', 'drug_code', 'substock_qty', 'usage_rate', 'qty', 'remarks'],
      ['REQ-001', 'DRUG-001', 50, 15, 10, 'เบิกด่วน'],
      ['REQ-001', 'DRUG-002', 20, 8, 5, ''],
      ['REQ-002', 'DRUG-003', 30, 10, 8, ''],
      ['REQ-002', 'DRUG-004', 10, 5, 3, '']
    ];
    const itemsSheet = XLSX.utils.aoa_to_sheet(itemsRows);
    itemsSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'รายการ (Items)');

    // Explanation sheet
    const explain = [
      ['📋 วิธีใช้งานไฟล์ Template แบบเชื่อมสัมพันธ์ชีต (Relational Sheets)'],
      [],
      ['1. ชีต "ใบเบิก (Headers)"'],
      ['   - ใส่ข้อมูลหัวใบเบิกหลัก โดยระบุ doc_no (เลขที่เอกสาร) ห้ามซ้ำกัน'],
      ['   - คอลัมน์สำคัญ: doc_no, doc_date, requester, approver'],
      ['   - requester และ approver: ระบุชื่อของพนักงานในระบบ (ระบบจะจับคู่ให้อัตโนมัติ)'],
      [],
      ['2. ชีต "รายการ (Items)"'],
      ['   - ใส่รายการยารวมทั้งหมดของทุกใบเบิก'],
      ['   - ระบุ doc_no ให้ตรงกับที่ระบุในชีตแรกเพื่อเชื่อมรายการเข้ากับใบเบิกให้ถูกต้อง'],
      ['   - คอลัมน์สำคัญ: doc_no, drug_code, qty']
    ];
    const explainSheet = XLSX.utils.aoa_to_sheet(explain);
    explainSheet['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, explainSheet, '📋 คำอธิบาย');

    XLSX.writeFile(wb, 'RKHSTOCK_Requisition_Import_Relational_Template.xlsx');
  };

  const downloadCSVTemplate = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const thFiscalYear = new Date().getFullYear() + 543;
    const csvContent = [
      '# หมายเหตุ: รูปแบบ CSV แบบหลายใบเบิก คั่นแต่ละใบด้วย [REQ_START] และ [REQ_END]',
      '',
      '[REQ_START]',
      `doc_no,REQ-001`,
      `doc_date,${todayStr}`,
      `fiscal_year,${thFiscalYear}`,
      'requester,ชื่อผู้เบิก',
      'approver,ชื่อผู้อนุมัติจ่าย',
      'remarks,',
      '[ITEMS]',
      'drug_code,substock_qty,usage_rate,qty,remarks',
      'DRUG-001,50,15,10,เบิกด่วนประจำตึก',
      'DRUG-002,20,8,5,',
      '[REQ_END]',
      '',
      '[REQ_START]',
      `doc_no,REQ-002`,
      `doc_date,${todayStr}`,
      `fiscal_year,${thFiscalYear}`,
      'requester,ชื่อผู้เบิก 2',
      'approver,ชื่อผู้อนุมัติจ่าย 2',
      'remarks,',
      '[ITEMS]',
      'drug_code,substock_qty,usage_rate,qty,remarks',
      'DRUG-003,30,10,8,',
      'DRUG-004,10,5,3,',
      '[REQ_END]'
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'RKHSTOCK_Requisition_Import_Template_Multi.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // 4. File Import Parser Logic
  // ==========================================
  const parseItems = (sheetRows: unknown[][], headerRowIndex: number, endRowIndex: number, dbProducts: ProductResult[]) => {
    const headers = sheetRows[headerRowIndex].map((h: unknown) => (h ?? '').toString().trim().toLowerCase());
    const getColIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase().trim());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const codeIdx = getColIndex(['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์']);
    const substockIdx = getColIndex(['substock_qty', 'substock', 'คงเหลือ', 'จำนวนคงเหลือ', 'balance']);
    const usageIdx = getColIndex(['usage_rate', 'usage', 'อัตราใช้', 'อัตราการใช้', 'rate', 'monthly_usage']);
    const qtyIdx = getColIndex(['qty', 'quantity', 'จำนวน', 'จำนวนเบิก']);
    const remIdx = getColIndex(['remarks', 'remark', 'หมายเหตุ']);

    const items: ImportItem[] = [];
    for (let r = headerRowIndex + 1; r < endRowIndex; r++) {
      const row = sheetRows[r];
      const drugCode = codeIdx !== -1 ? (row[codeIdx] ?? '').toString().trim() : '';
      if (!drugCode || drugCode.startsWith('#')) continue;

      const subQty = substockIdx !== -1 ? parseFloat((row[substockIdx] ?? 0).toString()) : 0;
      const usageVal = usageIdx !== -1 ? parseFloat((row[usageIdx] ?? 0).toString()) : 0;
      const qtyVal = qtyIdx !== -1 ? parseInt((row[qtyIdx] ?? 0).toString()) : 0;
      const remarkVal = remIdx !== -1 ? (row[remIdx] ?? '').toString().trim() : '';
      const rowNum = r + 1;

      const product = dbProducts.find(p => p.drug_code && p.drug_code.toLowerCase() === drugCode.toLowerCase());
      if (product) {
        items.push({
          rowNum,
          status: 'ready',
          product_id: product.id,
          product_name: product.generic_name,
          drug_code: product.drug_code || '',
          pack_size: product.pack_size || 1,
          unit_name: getUnitName(product.master_units as any),
          qty: qtyVal,
          is_manual_rate: false,
          months: globalMonths,
          suggested_qty: 0,
          avg_monthly_usage: 0,
          manual_monthly_usage: usageVal || product.manual_monthly_usage || 0,
          usage_rate: usageVal || product.manual_monthly_usage || 0,
          is_psycho_narco: product.is_psycho_narco || false,
          is_high_alert: product.is_high_alert || false,
          is_cold_storage: product.is_cold_storage || false,
          substock_qty: subQty,
          remarks: remarkVal,
          abbreviation: product.abbreviation || '',
        });
      } else {
        items.push({
          rowNum,
          status: 'not_found',
          drug_code: drugCode,
          product_name: 'ไม่พบในระบบ',
          qty: qtyVal,
          remarks: remarkVal,
          errorMessage: 'ไม่พบรหัสเวชภัณฑ์ในฐานข้อมูล',
        });
      }
    }
    return items;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    setImportStep('processing');
    setImportError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const binaryStr = e.target?.result;
        const wb = XLSX.read(binaryStr, { type: 'binary' });

        // Retrieve active database products
        const { data: dbProducts, error: dbErr } = await supabase
          .from('products')
          .select('id, drug_code, generic_name, abbreviation, pack_size, manual_monthly_usage, is_psycho_narco, is_high_alert, is_cold_storage, master_units(name:unit_name)')
          .eq('is_active', true);

        if (dbErr || !dbProducts) throw new Error('ไม่สามารถดึงข้อมูลเวชภัณฑ์จากระบบได้');

        // Setup helper for sheets
        const parseSheetBlock = (sheetName: string) => {
          const sheet = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
          if (rows.length === 0) return null;

          const firstCell = (rows[0]?.[0] ?? '').toString().trim();
          if (firstCell.startsWith('📋') || firstCell.startsWith('#')) return null;

           const headerObj: Record<string, unknown> = {};
          let itemsHeaderIndex = -1;

          for (let r = 0; r < rows.length; r++) {
            const key = (rows[r][0] ?? '').toString().trim().toLowerCase();
            if (TEMPLATE_HEADERS.includes(key)) {
              headerObj[key] = rows[r][1]; // Keep raw type (could be Date or number)
            }
            if (['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์'].includes(key)) {
              itemsHeaderIndex = r;
              break;
            }
          }

          if (itemsHeaderIndex === -1) return null;

          const parsedItems = parseItems(rows as unknown[][], itemsHeaderIndex, rows.length, dbProducts as unknown as ProductResult[]);
          const requesterStr = String(headerObj.requester ?? '').trim();
          const approverStr = String(headerObj.approver ?? headerObj.issuer ?? '').trim();
          const matchedReq = officers.find(s => s.full_name?.toLowerCase().includes(requesterStr.toLowerCase()));
          const matchedApp = officers.find(s => s.full_name?.toLowerCase().includes(approverStr.toLowerCase()));

          return {
            sheetName,
            docHeader: {
              doc_no: String(headerObj.doc_no ?? '').trim(),
              doc_date: parseExcelDate(headerObj.doc_date),
              fiscal_year: String(headerObj.fiscal_year ?? '').trim(),
              requester: requesterStr,
              approver: approverStr,
              remarks: String(headerObj.remarks ?? '').trim(),
              status: String(headerObj.status ?? '').trim() || 'draft',
            },
            items: parsedItems,
            matchedRequesterId: matchedReq?.id || null,
            matchedApproverId: matchedApp?.id || null,
            errors: parsedItems.length === 0 ? ['ไม่พบรายการยาในชีตนี้'] : [],
          };
        };

        const sheetNames = wb.SheetNames;
        const mainSheet = wb.Sheets[sheetNames[0]];
        const mainRows = XLSX.utils.sheet_to_json(mainSheet, { header: 1 }) as unknown[][];

        // Check if there is relational sheets format (Headers sheet + Items sheet)
        let headersSheetObj: XLSX.WorkSheet | null = null;
        let itemsSheetObj: XLSX.WorkSheet | null = null;
        let headersSheetName = '';
        let itemsSheetName = '';

        if (sheetNames.length > 1) {
          for (const sName of sheetNames) {
            const s = wb.Sheets[sName];
            const rows = XLSX.utils.sheet_to_json(s, { header: 1 }) as unknown[][];
            if (rows.length === 0) continue;

            let firstContentRow: any[] = [];
            for (const r of rows) {
              if (r && r.length > 0 && !(r[0] ?? '').toString().trim().startsWith('📋') && !(r[0] ?? '').toString().trim().startsWith('#')) {
                firstContentRow = r.map((cell: any) => (cell ?? '').toString().trim().toLowerCase());
                break;
              }
            }

            const hasDrugCode = firstContentRow.some((cell: any) => ['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์'].includes(cell));
            const hasDocNo = firstContentRow.some((cell: any) => ['doc_no', 'เลขที่เอกสาร', 'เลขใบเบิก'].includes(cell));
            const hasRequester = firstContentRow.some((cell: any) => ['requester', 'ผู้เบิก', 'ชื่อผู้เบิก'].includes(cell));
            const hasApprover = firstContentRow.some((cell: any) => ['approver', 'ผู้อนุมัติ', 'ชื่อผู้อนุมัติจ่าย', 'issuer', 'ผู้ตรวจรับ'].includes(cell));
            const hasDocDate = firstContentRow.some((cell: any) => ['doc_date', 'วันที่', 'วันที่เบิก'].includes(cell));

            if (hasDrugCode && hasDocNo) {
              itemsSheetObj = s;
              itemsSheetName = sName;
            } else if (hasDocNo && (hasRequester || hasApprover || hasDocDate)) {
              headersSheetObj = s;
              headersSheetName = sName;
            }
          }
        }

        const isRelational = !!headersSheetObj && !!itemsSheetObj;
        const isMultiSheet = sheetNames.length > 1 && !isRelational;
        const isCSVMultiBlock = mainRows.some(row => (row[0] ?? '').toString().trim().toLowerCase() === REQ_START);

        // 1. Parse Relational Sheets
        if (isRelational && headersSheetObj && itemsSheetObj) {
          const blocksList: MultiImportBlock[] = [];
          const headerRows = XLSX.utils.sheet_to_json(headersSheetObj, { header: 1 }) as unknown[][];
          let headerColRowIndex = -1;
          for (let r = 0; r < headerRows.length; r++) {
            if (headerRows[r].map((cell: any) => (cell ?? '').toString().trim().toLowerCase()).some((cell: any) => ['doc_no', 'เลขที่เอกสาร', 'เลขใบเบิก'].includes(cell))) {
              headerColRowIndex = r;
              break;
            }
          }

          const parsedHeaders: ImportDocHeader[] = [];
          if (headerColRowIndex !== -1) {
            const hCols = headerRows[headerColRowIndex].map((cell: any) => (cell ?? '').toString().trim().toLowerCase());
            const getValByAlias = (row: any[], aliases: string[]) => {
              for (const a of aliases) {
                const idx = hCols.indexOf(a.toLowerCase().trim());
                if (idx !== -1) return (row[idx] ?? '').toString().trim();
              }
              return '';
            };

            const getRawValByAlias = (row: any[], aliases: string[]) => {
              for (const a of aliases) {
                const idx = hCols.indexOf(a.toLowerCase().trim());
                if (idx !== -1) return row[idx];
              }
              return null;
            };

            for (let r = headerColRowIndex + 1; r < headerRows.length; r++) {
              const row = headerRows[r];
              if (!row || row.length === 0) continue;
              const docNoRaw = getRawValByAlias(row, ['doc_no', 'เลขที่เอกสาร', 'เลขใบเบิก']);
              const docNo = docNoRaw !== null && docNoRaw !== undefined ? String(docNoRaw).trim() : '';
              if (!docNo || docNo.startsWith('#') || docNo.startsWith('📋')) continue;

              const reqVal = getRawValByAlias(row, ['requester', 'ผู้เบิก', 'ชื่อผู้เบิก']);
              const appVal = getRawValByAlias(row, ['approver', 'ผู้อนุมัติ', 'ชื่อผู้อนุมัติจ่าย', 'issuer', 'ผู้ตรวจรับ']);
              const remVal = getRawValByAlias(row, ['remarks', 'remark', 'หมายเหตุ']);
              const fyVal = getRawValByAlias(row, ['fiscal_year', 'ปีงบประมาณ', 'ปี']);
              const statVal = getRawValByAlias(row, ['status', 'สถานะ']);

              parsedHeaders.push({
                doc_no: docNo,
                doc_date: parseExcelDate(getRawValByAlias(row, ['doc_date', 'วันที่', 'วันที่เบิก'])),
                fiscal_year: fyVal !== null && fyVal !== undefined ? String(fyVal).trim() : '',
                requester: reqVal !== null && reqVal !== undefined ? String(reqVal).trim() : '',
                approver: appVal !== null && appVal !== undefined ? String(appVal).trim() : '',
                remarks: remVal !== null && remVal !== undefined ? String(remVal).trim() : '',
                status: statVal !== null && statVal !== undefined ? String(statVal).trim() : 'draft',
              });
            }
          }

          const itemsRows = XLSX.utils.sheet_to_json(itemsSheetObj, { header: 1 }) as unknown[][];
          let itemsColRowIndex = -1;
          for (let r = 0; r < itemsRows.length; r++) {
            const rowCols = itemsRows[r].map((cell: any) => (cell ?? '').toString().trim().toLowerCase());
            const hasDoc = rowCols.some((c: any) => ['doc_no', 'เลขที่เอกสาร', 'เลขใบเบิก'].includes(c));
            const hasCode = rowCols.some((c: any) => ['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์'].includes(c));
            if (hasDoc && hasCode) {
              itemsColRowIndex = r;
              break;
            }
          }

          const itemsByDocNo: Record<string, ImportItem[]> = {};
          if (itemsColRowIndex !== -1) {
            const iCols = itemsRows[itemsColRowIndex].map((cell: any) => (cell ?? '').toString().trim().toLowerCase());
            const getColIdx = (aliases: string[]) => {
              for (const a of aliases) {
                const idx = iCols.indexOf(a.toLowerCase().trim());
                if (idx !== -1) return idx;
              }
              return -1;
            };

            const docNoIdx = getColIdx(['doc_no', 'เลขที่เอกสาร', 'เลขใบเบิก']);
            const codeIdx = getColIdx(['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์']);
            const substockIdx = getColIdx(['substock_qty', 'substock', 'คงเหลือ', 'จำนวนคงเหลือ', 'balance']);
            const usageIdx = getColIdx(['usage_rate', 'usage', 'อัตราใช้', 'อัตราการใช้', 'rate', 'monthly_usage']);
            const qtyIdx = getColIdx(['qty', 'quantity', 'จำนวน', 'จำนวนเบิก']);
            const remIdx = getColIdx(['remarks', 'remark', 'หมายเหตุ']);

            for (let r = itemsColRowIndex + 1; r < itemsRows.length; r++) {
              const row = itemsRows[r];
              if (!row || row.length === 0) continue;
              const docNo = docNoIdx !== -1 ? (row[docNoIdx] ?? '').toString().trim() : '';
              const drugCode = codeIdx !== -1 ? (row[codeIdx] ?? '').toString().trim() : '';
              if (!docNo || !drugCode || drugCode.startsWith('#') || drugCode.startsWith('📋')) continue;

              const subQty = substockIdx !== -1 ? parseFloat((row[substockIdx] ?? 0).toString()) : 0;
              const usageVal = usageIdx !== -1 ? parseFloat((row[usageIdx] ?? 0).toString()) : 0;
              const qtyVal = qtyIdx !== -1 ? parseInt((row[qtyIdx] ?? 0).toString()) : 0;
              const remarkVal = remIdx !== -1 ? (row[remIdx] ?? '').toString().trim() : '';
              const rowNum = r + 1;

              const product = dbProducts.find(p => p.drug_code && p.drug_code.toLowerCase() === drugCode.toLowerCase());

              if (!itemsByDocNo[docNo]) itemsByDocNo[docNo] = [];

              if (product) {
                itemsByDocNo[docNo].push({
                  rowNum,
                  status: 'ready',
                  product_id: product.id,
                  product_name: product.generic_name,
                  drug_code: product.drug_code || '',
                  pack_size: product.pack_size || 1,
                  unit_name: getUnitName(product.master_units as any),
                  qty: qtyVal,
                  is_manual_rate: false,
                  months: globalMonths,
                  suggested_qty: 0,
                  avg_monthly_usage: 0,
                  manual_monthly_usage: usageVal,
                  is_psycho_narco: product.is_psycho_narco || false,
                  is_high_alert: product.is_high_alert || false,
                  is_cold_storage: product.is_cold_storage || false,
                  substock_qty: subQty,
                  remarks: remarkVal,
                  abbreviation: product.abbreviation || '',
                });
              } else {
                itemsByDocNo[docNo].push({
                  rowNum,
                  status: 'not_found',
                  drug_code: drugCode,
                  product_name: 'ไม่พบในระบบ',
                  qty: qtyVal,
                  remarks: remarkVal,
                  errorMessage: 'ไม่พบรหัสยาในระบบ',
                });
              }
            }
          }

          for (const header of parsedHeaders) {
            const blockItems = itemsByDocNo[header.doc_no] || [];
            const matchedReq = officers.find(s => s.full_name?.toLowerCase().includes((header.requester || '').toLowerCase()));
            const matchedApp = officers.find(s => s.full_name?.toLowerCase().includes((header.approver || '').toLowerCase()));

            blocksList.push({
              blockIndex: blocksList.length,
              sheetName: `ใบเบิก ${header.doc_no}`,
              docHeader: header,
              items: blockItems,
              matchedRequesterId: matchedReq?.id || null,
              matchedApproverId: matchedApp?.id || null,
              errors: blockItems.length === 0 ? ['ไม่พบรายการยาสำหรับใบเบิกนี้'] : [],
            });
          }

          if (blocksList.length === 0) {
            setImportError('ไม่พบข้อมูลใบเบิกที่สมบูรณ์ในรูปแบบ Relational');
            setImportStep('upload');
            setIsSubmitting(false);
            return;
          }

          setImportMode('multi');
          setMultiImportBlocks(blocksList);
          setActivePreviewBlockIndex(0);
          setImportStep('preview');

        // 2. Parse Multi-Sheet (Each sheet is a requisition)
        } else if (isMultiSheet) {
          const blocksList: MultiImportBlock[] = [];
          for (let s = 0; s < sheetNames.length; s++) {
            const sName = sheetNames[s];
            const parsedBlock = parseSheetBlock(sName);
            if (parsedBlock) {
              blocksList.push({
                blockIndex: blocksList.length,
                ...parsedBlock
              });
            }
          }

          if (blocksList.length === 0) {
            setImportError('ไม่พบข้อมูลใบเบิกในไฟล์ กรุณาตรวจสอบโครงสร้าง Sheet');
            setImportStep('upload');
            setIsSubmitting(false);
            return;
          }

          setImportMode('multi');
          setMultiImportBlocks(blocksList);
          setActivePreviewBlockIndex(0);
          setImportStep('preview');

        // 3. Parse CSV Multi-Block [REQ_START]...[REQ_END]
        } else if (isCSVMultiBlock) {
          const blocksList: MultiImportBlock[] = [];
          let rowIdx = 0;

          while (rowIdx < mainRows.length) {
            const firstCell = (mainRows[rowIdx][0] ?? '').toString().trim().toLowerCase();
            if (firstCell === REQ_START) {
              const headerObj: Record<string, unknown> = {};
              let itemsHeaderIdx = -1;
              let endIdx = mainRows.length;

              rowIdx++;
              while (rowIdx < mainRows.length) {
                const innerCell = (mainRows[rowIdx][0] ?? '').toString().trim().toLowerCase();
                if (innerCell === ITEMS_HEADER) {
                  itemsHeaderIdx = rowIdx + 1;
                  rowIdx++;
                  break;
                }
                if (innerCell === REQ_END) {
                  endIdx = rowIdx;
                  break;
                }
                if (TEMPLATE_HEADERS.includes(innerCell)) {
                  headerObj[innerCell] = mainRows[rowIdx][1];
                }
                rowIdx++;
              }

              if (itemsHeaderIdx !== -1) {
                while (rowIdx < mainRows.length) {
                  if ((mainRows[rowIdx][0] ?? '').toString().trim().toLowerCase() === REQ_END) {
                    endIdx = rowIdx;
                    rowIdx++;
                    break;
                  }
                  rowIdx++;
                }
              }

              const blockItems = itemsHeaderIdx !== -1 ? parseItems(mainRows, itemsHeaderIdx - 1, endIdx, dbProducts) : [];
              const requesterStr = String(headerObj.requester ?? '').trim();
              const approverStr = String(headerObj.approver ?? headerObj.issuer ?? '').trim();
              const matchedReq = officers.find(s => s.full_name?.toLowerCase().includes(requesterStr.toLowerCase()));
              const matchedApp = officers.find(s => s.full_name?.toLowerCase().includes(approverStr.toLowerCase()));

              blocksList.push({
                blockIndex: blocksList.length,
                docHeader: {
                  doc_no: String(headerObj.doc_no ?? '').trim(),
                  doc_date: parseExcelDate(headerObj.doc_date),
                  fiscal_year: String(headerObj.fiscal_year ?? '').trim(),
                  requester: requesterStr,
                  approver: approverStr,
                  remarks: String(headerObj.remarks ?? '').trim(),
                  status: String(headerObj.status ?? '').trim() || 'draft',
                },
                items: blockItems,
                matchedRequesterId: matchedReq?.id || null,
                matchedApproverId: matchedApp?.id || null,
                errors: blockItems.length === 0 ? ['ไม่พบรายการยาในใบเบิกนี้'] : [],
              });
            } else {
              rowIdx++;
            }
          }

          if (blocksList.length === 0) {
            setImportError('ไม่พบ Block [REQ_START]...[REQ_END] ในไฟล์');
            setImportStep('upload');
            setIsSubmitting(false);
            return;
          }

          setImportMode('multi');
          setMultiImportBlocks(blocksList);
          setActivePreviewBlockIndex(0);
          setImportStep('preview');

        // 4. Parse Single Requisition Sheet
        } else {
          const headerObj: Record<string, unknown> = {};
          let itemsHeaderIndex = -1;

          for (let r = 0; r < mainRows.length; r++) {
            const key = (mainRows[r][0] ?? '').toString().trim().toLowerCase();
            if (TEMPLATE_HEADERS.includes(key)) {
              headerObj[key] = mainRows[r][1]; // Keep raw
            }
            if (['drug_code', 'code', 'รหัสยา', 'รหัสเวชภัณฑ์'].includes(key)) {
              itemsHeaderIndex = r;
              break;
            }
          }

          if (mainRows.length === 0 || itemsHeaderIndex === -1) {
            setImportError('ไม่พบแถวหัวคอลัมน์รายการ (drug_code) ในไฟล์');
            setImportStep('upload');
            setIsSubmitting(false);
            return;
          }

          setImportDocHeader({
            doc_no: String(headerObj.doc_no ?? '').trim(),
            doc_date: parseExcelDate(headerObj.doc_date),
            fiscal_year: String(headerObj.fiscal_year ?? '').trim(),
            requester: String(headerObj.requester ?? '').trim(),
            approver: String(headerObj.approver ?? headerObj.issuer ?? '').trim(),
            status: String(headerObj.status ?? '').trim() || 'draft',
            remarks: String(headerObj.remarks ?? '').trim(),
          });

          const items = parseItems(mainRows, itemsHeaderIndex, mainRows.length, dbProducts);
          setImportMode('single');
          setSingleImportItems(items);
          setImportStep('preview');
        }

      } catch (err: unknown) {
        setImportError('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + (err as any).message);
        setImportStep('upload');
      } finally {
        setIsSubmitting(false);
      }
    };

    reader.readAsBinaryString(file);
    event.target.value = '';
  };

  const handleConfirmSingleImport = () => {
    const readyItems = singleImportItems.filter((item: any) => item.status === 'ready');
    if (readyItems.length === 0) {
      alert('ไม่มีรายการเวชภัณฑ์ที่พร้อมนำเข้า');
      return;
    }

    if (importDocHeader) {
      if (importDocHeader.doc_date) {
        setValue('doc_date', importDocHeader.doc_date);
      }
      if (importDocHeader.requester) {
        const req = officers.find(s => s.full_name?.toLowerCase().includes(importDocHeader.requester.toLowerCase()));
        if (req) setValue('requester_id', req.id);
      }
      if (importDocHeader.approver) {
        const app = officers.find(s => s.full_name?.toLowerCase().includes(importDocHeader.approver.toLowerCase()));
        if (app) setValue('approver_id', app.id);
      }
    }

    const currentFields = watchItems;
    const isFirstEmpty = currentFields.length === 1 && !currentFields[0].product_id;

    const newList = readyItems.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      qty: item.qty,
      pack_size: item.pack_size,
      unit_name: item.unit_name,
      is_manual_rate: item.is_manual_rate,
      months: item.months,
      suggested_qty: item.suggested_qty,
      avg_monthly_usage: item.avg_monthly_usage,
      manual_monthly_usage: item.manual_monthly_usage,
      usage_rate: item.usage_rate || item.manual_monthly_usage || 0,
      drug_code: item.drug_code,
      is_psycho_narco: item.is_psycho_narco,
      is_high_alert: item.is_high_alert,
      is_cold_storage: item.is_cold_storage,
      substock_qty: item.substock_qty,
      remarks: item.remarks,
      abbreviation: item.abbreviation,
    }));

    if (isFirstEmpty) {
      remove(0);
    }
    newList.forEach((item: any) => append(item));
    handleCloseImportModal();
    alert(`นำเข้ารายการสำเร็จ ทั้งหมด ${readyItems.length} รายการ เรียบร้อยแล้ว!`);
  };

  const handleConfirmMultiImport = async () => {
    setImportStep('processing');
    const successes: ImportResult[] = [];
    const errorsList: string[] = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");
      const userId = session.user.id;

      for (const block of multiImportBlocks) {
        const readyItems = block.items.filter((item: any) => item.status === 'ready');
        if (readyItems.length === 0) {
          errorsList.push(`ใบเบิก "${block.docHeader.doc_no || `#${block.blockIndex + 1}`}": ไม่มีรายการพร้อมนำเข้า`);
          continue;
        }

        const reqOfficer = officers.find(s => s.id === block.matchedRequesterId);
        const appOfficer = officers.find(s => s.id === block.matchedApproverId);

        // INSERT Requisition Header
        const { data: reqData, error: reqError } = await supabase
          .from('requisitions')
          .insert({
            doc_date: block.docHeader.doc_date || new Date().toISOString().split('T')[0],
            requester_id: block.matchedRequesterId || null,
            requester_position: reqOfficer?.position || null,
            approver_id: block.matchedApproverId || null,
            approver_position: appOfficer?.position || null,
            status: 'COMPLETED',
            created_by: userId,
            remarks: block.docHeader.remarks || null,
          })
          .select('id, doc_no')
          .single();

        if (reqError) {
          errorsList.push(`ใบเบิก "${block.docHeader.doc_no || `#${block.blockIndex + 1}`}": ${reqError.message}`);
          continue;
        }

        // Prepare Items to Insert
        const itemsToInsert = readyItems.map((item: any) => ({
          requisition_id: reqData.id,
          product_id: item.product_id,
          qty: item.qty,
          pack_size: item.pack_size,
          unit_name: item.unit_name,
          created_by: userId,
          remarks: item.remarks || null,
          substock_qty: item.substock_qty || 0,
          usage_rate: item.manual_monthly_usage || 0,
        }));

        const { error: itemsError } = await supabase
          .from('requisition_items')
          .insert(itemsToInsert);

        if (itemsError) {
          errorsList.push(`ใบเบิก "${reqData.doc_no}": บันทึกรายการล้มเหลว — ${itemsError.message}`);
          continue;
        }

        successes.push({ doc_no: reqData.doc_no, count: readyItems.length });
      }

      setImportResultList(successes);
      if (errorsList.length > 0) {
        setImportError(errorsList.join('\n'));
        if (successes.length === 0) {
          setImportStep('preview');
          setIsSubmitting(false);
          return;
        }
      } else {
        setImportError('');
      }
      setImportStep('success');

    } catch (err: unknown) {
      setImportError('เกิดข้อผิดพลาดในการบันทึกฐานข้อมูล: ' + (err as any).message);
      setImportStep('preview');
    }
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('upload');
    setSingleImportItems([]);
    setMultiImportBlocks([]);
    setImportDocHeader(null);
    setImportError('');
    setImportResultList([]);
  };

  // ==========================================
  // 5. Submit Handler
  // ==========================================
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");
      const userId = session.user.id;

      const reqOfficer = officers.find(s => s.id === data.requester_id);
      const appOfficer = officers.find(s => s.id === data.approver_id);

      let requisitionId = id;

      if (isEditMode) {
        // UPDATE Requisition
        const { error: updateError } = await supabase
          .from('requisitions')
          .update({
            doc_date: data.doc_date,
            requester_id: data.requester_id,
            requester_position: reqOfficer?.position || null,
            approver_id: data.approver_id,
            approver_position: appOfficer?.position || null,
            remarks: data.remarks || null,
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('requisition_items')
          .delete()
          .eq('requisition_id', id);

        if (deleteError) throw deleteError;

      } else {
        // INSERT Requisition
        const { data: reqData, error: reqError } = await supabase
          .from('requisitions')
          .insert({
            doc_date: data.doc_date,
            requester_id: data.requester_id,
            requester_position: reqOfficer?.position || null,
            approver_id: data.approver_id,
            approver_position: appOfficer?.position || null,
            status: 'DRAFT',
            created_by: userId,
            remarks: data.remarks || null,
          })
          .select('id, doc_no')
          .single();

        if (reqError) throw reqError;
        requisitionId = reqData.id;
      }

      // Prepare Requisition Items
      const itemsToInsert = data.items.map(item => ({
        requisition_id: requisitionId,
        product_id: item.product_id,
        qty: item.qty,
        pack_size: item.pack_size,
        unit_name: item.unit_name,
        created_by: userId,
        remarks: item.remarks || null,
        substock_qty: item.substock_qty || 0,
        usage_rate: item.usage_rate || 0,
      }));

      // INSERT Requisition Items
      const { error: itemsError } = await supabase
        .from('requisition_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Navigate to History page — clear draft first
      await clearDraft();
      navigate('/requisition/history');

    } catch (err: unknown) {
      console.error('Submit Error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: unknown) => {
    console.log("Validation Errors:", errors);
    alert('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง (มีแถบสีแดงแจ้งเตือน หรืออาจมีจำนวนเบิกเป็น 0)');
  };

  useEffect(() => {
    const handleGlobalHotkeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;
      const isAltA = e.altKey && (code === 'KeyA' || key === 'a' || key === 'ฟ');
      const isAltS = e.altKey && (code === 'KeyS' || key === 's' || key === 'ห');
      const isAltH = e.altKey && (code === 'KeyH' || key === 'h' || key === 'อ');

      if (isAltA) {
        e.preventDefault();
        e.stopPropagation();
        append({
          product_id: '',
          product_name: '',
          qty: 0,
          pack_size: 1,
          is_manual_rate: false,
          months: globalMonths,
          suggested_qty: 0,
          avg_monthly_usage: 0,
          manual_monthly_usage: 0,
          usage_rate: 0,
          drug_code: '',
          is_psycho_narco: false,
          is_high_alert: false,
          is_cold_storage: false,
          substock_qty: 0,
          remarks: '',
          abbreviation: '',
        });
        setTimeout(() => {
          const newRowIndex = fields.length;
          const newSearchInput = document.getElementById(`search-input-${newRowIndex}`) || document.querySelector(`[data-row="${newRowIndex}"][data-col="0"]`);
          (newSearchInput as HTMLInputElement)?.focus();
        }, 100);
      } else if (isAltS) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit(onSubmit, onInvalid)();
      } else if (isAltH) {
        e.preventDefault();
        e.stopPropagation();
        setIsShortcutsGuideOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [fields.length, append, globalMonths, handleSubmit]);

  const currentDocNoPlaceholder = `REQ${(watch('doc_date') || new Date().toISOString().split('T')[0]).replace(/-/g, '')}-XX`;


  return {
    isEditMode,
    editDocNo,
    isSubmitting,
    productSearch,
    setProductSearch,
    searchResults,
    systemAgeInDays,
    globalMonths,
    isLoadingAll,
    activeSearchRowIndex,
    setActiveSearchRowIndex,
    dropdownSelectedIndex,
    setDropdownSelectedIndex,
    isShortcutsGuideOpen,
    setIsShortcutsGuideOpen,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    isImportModalOpen,
    setIsImportModalOpen,
    importStep,
    setImportStep,
    importMode,
    setImportMode,
    singleImportItems,
    multiImportBlocks,
    activePreviewBlockIndex,
    setActivePreviewBlockIndex,
    safetyStockMonths,
    importDocHeader,
    importError,
    importResultList,
    searchContainerRef,
    importFileRef,
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    errors,
    fields,
    append,
    remove,
    watchItems,
    handleSelectProduct,
    handleAutoAdjustQty,
    handleAddAllActiveProducts,
    downloadStandardTemplate,
    downloadRelationalTemplate,
    downloadCSVTemplate,
    handleFileUpload,
    handleConfirmSingleImport,
    handleConfirmMultiImport,
    handleCloseImportModal,
    onSubmit,
    onInvalid,
    currentDocNoPlaceholder,
    // Draft
    pendingDraft,
    handleRestoreReqDraft,
    handleDiscardReqDraft,
    formatReqDraftTimestamp,
  };
}
