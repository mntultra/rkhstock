import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase'; // ปรับ path ให้ตรงกับโปรเจกต์ของคุณ
import { useNavigate } from 'react-router-dom'; // สมมติว่าใช้ React Router

// ==========================================
// 1. Zod Schema & Validation
// ==========================================
const itemSchema = z.object({
  product_id: z.string().uuid("กรุณาเลือกยา"),
  product_name: z.string().min(1, "กรุณาเลือกยา"),
  qty: z.number().min(1, "จำนวนเบิกต้องมากกว่า 0"),
  unit_name: z.string().optional(),
  
  // Settings สำหรับ Usage Rate
  is_manual_rate: z.boolean().default(false),
  months: z.number().default(6),
  
  // Data สำหรับแสดงผล
  suggested_qty: z.number().default(0),
  avg_monthly_usage: z.number().default(0),
});

const formSchema = z.object({
  doc_date: z.string().min(1, "กรุณาเลือกวันที่"),
  requester_id: z.string().uuid("กรุณาเลือกผู้เบิก"),
  approver_id: z.string().uuid("กรุณาเลือกผู้ตรวจรับ"),
  items: z.array(itemSchema)
    .min(1, "ต้องมีอย่างน้อย 1 รายการ")
    .refine((items) => {
      // Validate: ห้ามเลือกยาซ้ำในใบเดียวกัน
      const productIds = items.map((i) => i.product_id);
      return new Set(productIds).size === productIds.length;
    }, { message: "ห้ามเลือกยาซ้ำในใบเดียวกัน" }),
});

type FormValues = z.infer<typeof formSchema>;

// ==========================================
// 2. Main Component
// ==========================================
export default function RequisitionForm() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      doc_date: new Date().toISOString().split('T')[0],
      items: [{ product_id: '', product_name: '', qty: 0, is_manual_rate: false, months: 6 }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'items',
  });

  // Watch เฉพาะ items เพื่อเช็ค Error รวม (เช่น ยาซ้ำ)
  const watchItems = watch('items');

  // ==========================================
  // 3. Data Fetching
  // ==========================================
  useEffect(() => {
    // ดึงรายชื่อ User สำหรับ Dropdown
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('id, full_name, role');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  // ค้นหายา (Fuzzy Search)
  useEffect(() => {
    const searchProducts = async () => {
      if (productSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('id, generic_name, trade_name, unit_id(name)')
        .ilike('generic_name', `%${productSearch}%`)
        .eq('is_active', true)
        .limit(10);
      
      if (data) setSearchResults(data);
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [productSearch]);

  // ==========================================
  // 4. Action Handlers
  // ==========================================
  const handleSelectProduct = async (index: number, product: any) => {
    // 1. Set ค่าพื้นฐานลง Form
    update(index, {
      ...watchItems[index],
      product_id: product.id,
      product_name: product.generic_name,
      unit_name: product.unit_id?.name || '',
    });
    setProductSearch('');
    setSearchResults([]);

    // 2. Fetch Usage Rate อัตโนมัติ (Default 6 เดือน)
    await fetchAndSetUsageRate(index, product.id, watchItems[index].months || 6);
  };

  const fetchAndSetUsageRate = async (index: number, productId: string, months: number) => {
    if (!productId) return;
    
    const { data, error } = await supabase.rpc('get_usage_rate', {
      p_product_id: productId,
      p_months: months,
    });

    if (data && data[0]) {
      const result = data[0];
      const currentItem = watchItems[index];
      
      // Update form data โดยให้ qty แนะนำเป็น Default เฉพาะตอนที่ไม่ได้เปิด Manual Rate
      update(index, {
        ...currentItem,
        months,
        suggested_qty: result.suggested_order_qty,
        avg_monthly_usage: result.avg_monthly_usage,
        qty: currentItem.is_manual_rate ? currentItem.qty : result.suggested_order_qty,
      });
    }
  };

  const handleMonthsChange = (index: number, months: number) => {
    const item = watchItems[index];
    if (item.product_id) {
      fetchAndSetUsageRate(index, item.product_id, months);
    }
  };

  // ==========================================
  // 5. Submit Handler
  // ==========================================
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // ดึง User Session เพื่อเก็บ created_by
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");
      const userId = session.user.id;

      // INSERT หัวเอกสาร (หมายเหตุ: doc_no ให้ Database Trigger หรือ Default สร้าง format RQ-YYMM-seq ให้เพื่อป้องกัน Race Condition)
      const { data: reqData, error: reqError } = await supabase
        .from('requisitions')
        .insert({
          doc_date: data.doc_date,
          requester_id: data.requester_id,
          approver_id: data.approver_id,
          status: 'DRAFT', // หรือ PENDING
          created_by: userId,
        })
        .select('id, doc_no')
        .single();

      if (reqError) throw reqError;

      // เตรียม Data สำหรับ Items
      const itemsToInsert = data.items.map((item) => ({
        requisition_id: reqData.id,
        product_id: item.product_id,
        qty: item.qty,
        created_by: userId,
        // Constraint: เราจะ "ไม่ Insert ลง stock_movements" ที่นี่ เพราะใบเบิกยังไม่ใช่อนุมัติจ่าย
      }));

      // INSERT รายการยา
      const { error: itemsError } = await supabase
        .from('requisition_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // นำทางไปหน้า Print พร้อม ID ของใบเบิกที่เพิ่งสร้าง
      navigate(`/requisition/print/${reqData.id}`);
      
    } catch (error) {
      console.error("Submit Error:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 6. UI Render
  // ==========================================
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">สร้างใบเบิกยา (Requisition)</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-md">
          <div>
            <label className="block text-sm font-medium text-gray-700">วันที่เบิก</label>
            <input 
              type="date" 
              {...register('doc_date')} 
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
            />
            {errors.doc_date && <p className="text-red-500 text-xs mt-1">{errors.doc_date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ผู้เบิก (Requester)</label>
            <select {...register('requester_id')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              <option value="">-- เลือกผู้เบิก --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            {errors.requester_id && <p className="text-red-500 text-xs mt-1">{errors.requester_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ผู้ตรวจรับ (Approver)</label>
            <select {...register('approver_id')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              <option value="">-- เลือกผู้ตรวจรับ --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            {errors.approver_id && <p className="text-red-500 text-xs mt-1">{errors.approver_id.message}</p>}
          </div>
        </div>

        {/* Error ข้อความกรณียาซ้ำ */}
        {errors.items?.root?.message && (
          <div className="bg-red-50 p-3 rounded text-red-600 font-medium">
            {errors.items.root.message}
          </div>
        )}

        {/* Items Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">รายการยา</h2>
          
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 items-start p-4 border rounded-md hover:bg-gray-50 transition-colors">
              
              {/* ค้นหายา */}
              <div className="col-span-12 md:col-span-4 relative">
                <label className="block text-xs font-medium text-gray-500">ชื่อยา</label>
                {!watchItems[index].product_id ? (
                  <>
                    <input 
                      type="text"
                      placeholder="พิมพ์ชื่อยาสามัญ..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 text-sm"
                    />
                    {searchResults.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border shadow-lg max-h-40 overflow-y-auto rounded-md">
                        {searchResults.map(p => (
                          <li 
                            key={p.id} 
                            onClick={() => handleSelectProduct(index, p)}
                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                          >
                            {p.generic_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="mt-1 flex items-center justify-between p-2 bg-blue-50 text-blue-800 rounded text-sm font-medium">
                    <span>{watchItems[index].product_name}</span>
                    <button type="button" onClick={() => update(index, { product_id: '', product_name: '', qty: 0, is_manual_rate: false, months: 6 })} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                )}
                {errors.items?.[index]?.product_id && <p className="text-red-500 text-xs mt-1">{errors.items[index]?.product_id?.message}</p>}
              </div>

              {/* Usage Rate Settings */}
              <div className="col-span-12 md:col-span-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-500">รูปแบบยอดเบิก</label>
                  <Controller
                    control={control}
                    name={`items.${index}.is_manual_rate`}
                    render={({ field: { value, onChange } }) => (
                      <label className="inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={value} onChange={onChange} className="sr-only peer" />
                        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-2 text-xs font-medium text-gray-600">{value ? 'ระบุเอง' : 'Auto Rate'}</span>
                      </label>
                    )}
                  />
                </div>
                
                {!watchItems[index].is_manual_rate && (
                  <select 
                    {...register(`items.${index}.months`, { valueAsNumber: true })}
                    onChange={(e) => handleMonthsChange(index, parseInt(e.target.value))}
                    className="block w-full rounded-md border-gray-300 text-sm bg-gray-50"
                  >
                    <option value={3}>คำนวณย้อนหลัง 3 เดือน</option>
                    <option value={6}>คำนวณย้อนหลัง 6 เดือน</option>
                    <option value={9}>คำนวณย้อนหลัง 9 เดือน</option>
                    <option value={12}>คำนวณย้อนหลัง 12 เดือน</option>
                  </select>
                )}
              </div>

              {/* ข้อมูลแนะนำ */}
              <div className="col-span-12 md:col-span-2 flex flex-col justify-end text-right p-2">
                 <span className="text-xs text-gray-400">เฉลี่ยต่อเดือน: {watchItems[index].avg_monthly_usage || 0}</span>
                 <span className="text-xs font-semibold text-green-600">ยอดแนะนำ: {watchItems[index].suggested_qty || 0}</span>
              </div>

              {/* จำนวนเบิก */}
              <div className="col-span-12 md:col-span-2 relative">
                <label className="block text-xs font-medium text-gray-500">จำนวนเบิก</label>
                <div className="flex items-center mt-1">
                  <input 
                    type="number" 
                    {...register(`items.${index}.qty`, { valueAsNumber: true })}
                    disabled={!watchItems[index].is_manual_rate && !!watchItems[index].suggested_qty}
                    className="block w-full rounded-l-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 font-bold"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    {watchItems[index].unit_name || '-'}
                  </span>
                </div>
                {errors.items?.[index]?.qty && <p className="text-red-500 text-xs mt-1 absolute">{errors.items[index]?.qty?.message}</p>}
              </div>

              {/* ปุ่มลบแถว */}
              <div className="col-span-12 md:col-span-1 flex justify-end items-end pt-5">
                <button 
                  type="button" 
                  onClick={() => remove(index)}
                  className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ product_id: '', product_name: '', qty: 0, is_manual_rate: false, months: 6, suggested_qty: 0, avg_monthly_usage: 0 })}
            className="mt-4 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-md hover:border-blue-500 hover:text-blue-500 transition-colors w-full font-medium flex items-center justify-center gap-2"
          >
             <span>+ เพิ่มรายการยา</span>
          </button>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t mt-8">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all"
          >
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบเบิกยา'}
          </button>
        </div>

      </form>
    </div>
  );
}
