import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Edit2, Trash2, Pill, Activity, XOctagon, FileSpreadsheet, Upload, X, Download, Info, QrCode } from 'lucide-react';
import { DosageForm, ProductType, Unit } from '@/types';
import * as XLSX from 'xlsx';
import ProductBarcodeModal from './components/ProductBarcodeModal';

export default function ProductManagementPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [isImporting, setIsImporting] = useState(false);
  const [barcodePanelProduct, setBarcodePanelProduct] = useState<{ id: string; name: string } | null>(null);

  // Import Wizard States
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'summary'>('upload');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, skip: 0 });
  const [importResultSummary, setImportResultSummary] = useState({ success: 0, skip: 0, errors: [] as string[] });

  // Lookups for Dropdowns
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    drug_code: '',
    generic_name: '',
    abbreviation: '',
    dosage_form_id: '',
    pack_size: 1,
    unit_id: '',
    product_type_id: '',
    unit_price: 0,
    is_psycho_narco: false,
    is_high_alert: false,
    is_cold_storage: false,
    is_active: true,
    manual_monthly_usage: 0
  });

  const fetchLookups = async () => {
    const [df, pt, un] = await Promise.all([
      supabase.from('master_dosage_forms').select('*').order('name_en'),
      supabase.from('master_product_types').select('*').order('name'),
      supabase.from('master_units').select('id, name:unit_name').order('unit_name')
    ]);
    if (df.data) setDosageForms(df.data);
    if (pt.data) setProductTypes(pt.data);
    if (un.data) setUnits(un.data);
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    let query = supabase
      .from('products')
      .select('*, master_dosage_forms(name_en), master_product_types(name), master_units(name:unit_name)')
      .order('generic_name');

    if (search) {
      query = query.or(`generic_name.ilike.%${search}%,abbreviation.ilike.%${search}%,drug_code.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setProducts(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Counts & Filtering
  const activeCount = products.filter(p => p.is_active !== false).length;
  const inactiveCount = products.filter(p => p.is_active === false).length;

  const filteredProducts = products.filter(p => 
    activeTab === 'active' ? p.is_active !== false : p.is_active === false
  );

  // ฟังก์ชันดาวน์โหลดไฟล์ Excel ต้นแบบ
  const downloadExcelTemplate = () => {
    const headers = [
      'รหัสเวชภัณฑ์ (Drug Code)*',
      'ชื่อสามัญ (Generic Name)*',
      'ชื่อย่อ (Abbreviation)',
      'ชื่อย่อรูปแบบ (Dosage Form)*',
      'ประเภทเวชภัณฑ์ (Product Type) - เช่น ยาในบัญชี, ยานอกบัญชี, เวชภัณฑ์มิใช่ยา',
      'จำนวนบรรจุต่อแพ็ค (Pack Size) - ตัวเลข เช่น 1, 10, 100',
      'หน่วยนับ (Unit) - เช่น เม็ด, ขวด, หลอด, แผง',
      'ราคาต่อหน่วย (Unit Price) - ตัวเลข เช่น 1.50, 450.00',
      'อัตราการใช้/เดือน manual - ตัวเลข เช่น 100, 500',
      'วัตถุออกฤทธิ์ฯ (Psycho/Narco) - ระบุ TRUE หรือ FALSE',
      'เป็น HAD (High Alert Drug) - ระบุ TRUE หรือ FALSE',
      'เก็บในตู้เย็น (Cold Storage) - ระบุ TRUE หรือ FALSE'
    ];

    const sampleRows = [
      ['DRG-0001', 'Paracetamol 500mg', 'Sara 500', 'TAB', 'ยาในบัญชี', '10', 'เม็ด', '1.50', '500', 'FALSE', 'FALSE', 'FALSE'],
      ['DRG-0002', 'Amoxicillin 500mg', 'Amoxil', 'CAP', 'ยาในบัญชี', '100', 'เม็ด', '2.50', '200', 'FALSE', 'FALSE', 'FALSE'],
      ['DRG-0003', 'Insulin Glargine 100 U/mL', 'Lantus Solostar', 'INJ', 'ยานอกบัญชี', '1', 'ขวด', '450.00', '10', 'FALSE', 'TRUE', 'TRUE']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    // ตั้งค่าความกว้างคอลัมน์อัตโนมัติ
    ws['!cols'] = [
      { wch: 25 }, // Drug Code
      { wch: 30 }, // Generic Name
      { wch: 25 }, // Abbreviation
      { wch: 30 }, // Dosage Form (Abbr)
      { wch: 25 }, // Product Type
      { wch: 20 }, // Pack Size
      { wch: 15 }, // Unit
      { wch: 15 }, // Unit Price
      { wch: 25 }, // Manual Monthly Usage
      { wch: 25 }, // Psycho/Narco
      { wch: 20 }, // HAD
      { wch: 20 }  // Cold Storage
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'rkh_products_template.xlsx');
  };

  // ฟังก์ชันดาวน์โหลดไฟล์ CSV ต้นแบบ
  const downloadCsvTemplate = () => {
    const headers = [
      'drug_code',
      'generic_name',
      'abbreviation',
      'dosage_form_id',
      'product_type_id',
      'pack_size',
      'unit_id',
      'unit_price',
      'manual_monthly_usage',
      'is_psycho_narco',
      'is_high_alert',
      'is_cold_storage'
    ];

    const sampleRows = [
      ['DRG-0001', 'Paracetamol 500mg', 'Sara 500', 'TAB', 'เวชภัณฑ์ยา', '10', 'เม็ด', '1.50', '500', 'FALSE', 'FALSE', 'FALSE'],
      ['DRG-0002', 'Amoxicillin 500mg', 'Amoxil', 'CAP', 'เวชภัณฑ์ยา', '100', 'เม็ด', '2.50', '200', 'FALSE', 'FALSE', 'FALSE'],
      ['DRG-0003', 'Bottle 30 ml', 'BOTT', 'MED', 'เวชภัณฑ์มิใช่ยา', '100', 'ขวด', '450.00', '10', 'FALSE', 'FALSE', 'FALSE']
    ];

    // สร้างเนื้อหา CSV และใส่ BOM สำหรับภาษาไทยเพื่อให้ Excel แสดงผลได้ถูกต้อง
    const csvContent = [headers, ...sampleRows]
      .map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rkh_products_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ฟังก์ชันประมวลผลและแปลงข้อมูลจากไฟล์ Excel / CSV ไปพักไว้ที่ Client เพื่อทำ Preview
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // แปลงแผ่นงานเป็นโครงสร้างอาเรย์ของอาเรย์ข้อมูลดิบ
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        if (rows.length <= 1) {
          throw new Error('ไม่พบข้อมูลในไฟล์นำเข้า หรือไม่มีข้อมูลตามคอลัมน์ที่กำหนด');
        }

        const dataRows = rows.slice(1); // ข้ามแถวหัวข้อหลัก
        const items: any[] = [];

        for (let idx = 0; idx < dataRows.length; idx++) {
          const row: any = dataRows[idx];
          if (!row || row.length === 0) continue;

          const drugCode = row[0]?.toString().trim() || '';
          const genericName = row[1]?.toString().trim() || '';
          const abbreviation = row[2]?.toString().trim() || '';
          const dosageFormName = row[3]?.toString().trim() || '';
          const productTypeName = row[4]?.toString().trim() || '';
          const packSize = parseInt(row[5]) || 1;
          const unitName = row[6]?.toString().trim() || '';
          const unitPrice = parseFloat(row[7]) || 0;
          const manualMonthlyUsage = parseFloat(row[8]) || 0;
          const isPsychoNarco = row[9]?.toString().trim().toUpperCase() === 'TRUE';
          const isHighAlert = row[10]?.toString().trim().toUpperCase() === 'TRUE';
          const isColdStorage = row[11]?.toString().trim().toUpperCase() === 'TRUE';

          // ข้ามแถวที่ว่างเปล่าจริง ๆ
          if (!drugCode && !genericName && !abbreviation) continue;

          let validationStatus: 'ready' | 'error' = 'ready';
          let errorMessage = '';

          // ตรวจสอบข้อมูลบังคับ
          if (!drugCode || !genericName) {
            validationStatus = 'error';
            errorMessage = 'รหัสเวชภัณฑ์ (drug_code) หรือชื่อสามัญ (generic_name) ว่างเปล่า';
          }

          items.push({
            rowNum: idx + 2,
            drugCode,
            genericName,
            abbreviation,
            dosageFormName,
            productTypeName,
            packSize,
            unitName,
            unitPrice,
            manualMonthlyUsage,
            isPsychoNarco,
            isHighAlert,
            isColdStorage,
            validationStatus,
            errorMessage
          });
        }

        if (items.length === 0) {
          throw new Error('ไม่พบข้อมูลในไฟล์นำเข้า หรือไม่มีข้อมูลตามคอลัมน์ที่กำหนด');
        }

        setParsedItems(items);
        setImportStep('preview');
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการประมวลผลไฟล์: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = ''; // เคลียร์เพื่อให้เลือกไฟล์เดิมซ้ำได้
      }
    };

    reader.onerror = () => {
      alert('ไม่สามารถอ่านไฟล์ได้');
      setIsImporting(false);
      e.target.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  // ฟังก์ชันเริ่มดำเนินการบันทึกข้อมูลนำเข้าลงตาราง products ของ Supabase ทีละรายการ
  const startImporting = async () => {
    setImportStep('importing');
    setImportProgress({ current: 0, total: parsedItems.length, success: 0, skip: 0 });

    let successCount = 0;
    let skipCount = 0;
    let errorsList: string[] = [];

    try {
      // 1. โหลดข้อมูล Lookups เพื่อนำมาทำการตรวจสอบเปรียบเทียบในหน่วยความจำ
      const [dfRes, ptRes, unRes] = await Promise.all([
        supabase.from('master_dosage_forms').select('id, name_en, name_th, abbreviation'),
        supabase.from('master_product_types').select('id, name'),
        supabase.from('master_units').select('id, name:unit_name')
      ]);

      let currentDosageForms = dfRes.data || [];
      let currentProductTypes = ptRes.data || [];
      let currentUnits = unRes.data || [];

      // ฟังก์ชันอัจฉริยะช่วยค้นหาหรือจัดสร้างข้อมูล Lookup ในตารางคีย์นอกอัตโนมัติ
      const getOrCreateDosageForm = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;

        let found = currentDosageForms.find(
          item =>
            (item.abbreviation && item.abbreviation.toLowerCase() === trimmed.toLowerCase()) ||
            (item.name_en && item.name_en.toLowerCase() === trimmed.toLowerCase()) ||
            item.name_th === trimmed
        );
        if (found) return found.id;

        // ถ้าไม่มีในระบบ ให้ทำการสร้างใหม่ทันทีแบบเรียลไทม์
        const { data, error } = await supabase
          .from('master_dosage_forms')
          .insert([{ abbreviation: trimmed, name_en: trimmed, name_th: trimmed }])
          .select()
          .single();

        if (!error && data) {
          currentDosageForms.push(data);
          return data.id;
        }
        return null;
      };

      const getOrCreateProductType = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;

        let found = currentProductTypes.find(
          item => item.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (found) return found.id;

        const { data, error } = await supabase
          .from('master_product_types')
          .insert([{ name: trimmed }])
          .select()
          .single();

        if (!error && data) {
          currentProductTypes.push(data);
          return data.id;
        }
        return null;
      };

      const getOrCreateUnit = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return null;

        let found = currentUnits.find(
          item => item.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (found) return found.id;

        const { data, error } = await supabase
          .from('master_units')
          .insert([{ unit_name: trimmed }])
          .select('id, name:unit_name')
          .single();

        if (!error && data) {
          currentUnits.push(data);
          return data.id;
        }
        return null;
      };

      // 2. วนลูปนำข้อมูลเข้าระบบทีละรายการและอัปเดตสถานะแบบเรียลไทม์
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const rowNum = item.rowNum;

        // อัปเดตความคืบหน้าการทำงาน (Progress Status)
        setImportProgress(prev => ({
          ...prev,
          current: i + 1
        }));

        if (item.validationStatus === 'error') {
          skipCount++;
          errorsList.push(`แถวที่ ${rowNum}: ${item.errorMessage}`);
          setImportProgress(prev => ({ ...prev, skip: skipCount }));
          continue;
        }

        // ตรวจสอบความซ้ำของรหัสเวชภัณฑ์
        const { data: existingProd } = await supabase
          .from('products')
          .select('id')
          .eq('drug_code', item.drugCode)
          .maybeSingle();

        if (existingProd) {
          skipCount++;
          errorsList.push(`แถวที่ ${rowNum}: ข้ามเนื่องจากรหัสเวชภัณฑ์ "${item.drugCode}" มีอยู่ในฐานข้อมูลแล้ว`);
          setImportProgress(prev => ({ ...prev, skip: skipCount }));
          continue;
        }

        // ค้นหาคีย์นอกและทำการสร้างข้อมูล Lookup ความสัมพันธ์แบบเรียลไทม์
        const dosageFormId = await getOrCreateDosageForm(item.dosageFormName);
        const productTypeId = await getOrCreateProductType(item.productTypeName);
        const unitId = await getOrCreateUnit(item.unitName);

        // บันทึกรายการผลิตภัณฑ์ตัวใหม่ลงในฐานข้อมูล Supabase
        const { error: insertError } = await supabase
          .from('products')
          .insert([{
            drug_code: item.drugCode,
            generic_name: item.genericName,
            abbreviation: item.abbreviation,
            dosage_form_id: dosageFormId,
            product_type_id: productTypeId,
            pack_size: item.packSize,
            unit_id: unitId,
            unit_price: item.unitPrice,
            manual_monthly_usage: item.manualMonthlyUsage,
            is_psycho_narco: item.isPsychoNarco,
            is_high_alert: item.isHighAlert,
            is_cold_storage: item.isColdStorage,
            is_active: true
          }]);

        if (insertError) {
          skipCount++;
          errorsList.push(`แถวที่ ${rowNum}: ไม่สามารถนำเข้าได้ (${insertError.message})`);
          setImportProgress(prev => ({ ...prev, skip: skipCount }));
        } else {
          successCount++;
          setImportProgress(prev => ({ ...prev, success: successCount }));
        }
      }
    } catch (err: any) {
      errorsList.push(`เกิดข้อผิดพลาดในการนำเข้า: ${err.message}`);
    } finally {
      // สรุปผลลัพธ์ทั้งหมด
      setImportResultSummary({
        success: successCount,
        skip: skipCount,
        errors: errorsList
      });
      setImportStep('summary');
      fetchProducts(); // โหลดหน้าตารางเวชภัณฑ์ใหม่
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.drug_code) return alert('กรุณาระบุรหัสเวชภัณฑ์');

    try {
      // Map empty string to null for foreign keys
      const payload = {
        ...formData,
        dosage_form_id: formData.dosage_form_id || null,
        product_type_id: formData.product_type_id || null,
        unit_id: formData.unit_id || null,
      };

      if (editingId) {
        // Update
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) {
          if (error.code === '23505') throw new Error('รหัสเวชภัณฑ์ (Drug Code) นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
          throw error;
        }
      } else {
        // Insert
        const { error } = await supabase.from('products').insert([payload]);
        if (error) {
          if (error.code === '23505') throw new Error('รหัสเวชภัณฑ์ (Drug Code) นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
          throw error;
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ drug_code: '', generic_name: '', abbreviation: '', dosage_form_id: '', pack_size: 1, unit_id: '', product_type_id: '', unit_price: 0, is_psycho_narco: false, is_high_alert: false, is_cold_storage: false, is_active: true, manual_monthly_usage: 0 });
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setFormData({
      drug_code: product.drug_code || '',
      generic_name: product.generic_name || '',
      abbreviation: product.abbreviation || '',
      dosage_form_id: product.dosage_form_id || '',
      pack_size: product.pack_size || 1,
      unit_id: product.unit_id || '',
      product_type_id: product.product_type_id || '',
      unit_price: product.unit_price || 0,
      is_psycho_narco: product.is_psycho_narco || false,
      is_high_alert: product.is_high_alert || false,
      is_cold_storage: product.is_cold_storage || false,
      is_active: product.is_active ?? true,
      manual_monthly_usage: product.manual_monthly_usage || 0
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('products').update({ is_active: !currentStatus }).eq('id', id);
    fetchProducts();
  };

  const handleDelete = async (id: string, genericName: string) => {
    if (!window.confirm(`ยืนยันการลบเวชภัณฑ์ "${genericName}" ออกจากระบบอย่างถาวรใช่หรือไม่?\n\n⚠️ การดำเนินการนี้ไม่สามารถยกเลิกได้`)) return;
    try {
      // เคลียร์ FK ใน stock_audit_logs ก่อนลบ
      await supabase.from('stock_audit_logs').update({ product_id: null }).eq('product_id', id);
      // ลบ product
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (err: any) {
      alert('ไม่สามารถลบเวชภัณฑ์ได้: ' + err.message);
    }
  };

  return (
    <div className="glass rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <Pill size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">จัดการข้อมูลยาและเวชภัณฑ์</h1>
            <p className="text-sm text-gray-500 font-medium">เพิ่ม แก้ไข หรือระงับการใช้งานเวชภัณฑ์ในคลัง</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row w-full lg:w-auto items-stretch lg:items-center gap-3">
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อเวชภัณฑ์, ชื่อย่อ, รหัส..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import Excel / CSV Trigger Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 border border-emerald-200 text-emerald-700 bg-emerald-50/50 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-all text-sm whitespace-nowrap"
              title="นำเข้าข้อมูลยาและเวชภัณฑ์จากไฟล์ Excel หรือ CSV"
            >
              <FileSpreadsheet size={18} />
              <span>นำเข้าข้อมูล Excel / CSV</span>
            </button>

            {/* Add New Item Button */}
            <button
              onClick={() => { setEditingId(null); setFormData({ drug_code: '', generic_name: '', abbreviation: '', dosage_form_id: '', pack_size: 1, unit_id: '', product_type_id: '', unit_price: 0, is_psycho_narco: false, is_high_alert: false, is_cold_storage: false, is_active: true, manual_monthly_usage: 0 }); setIsModalOpen(true); }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-850 hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm whitespace-nowrap"
            >
              <Plus size={18} />
              <span>เพิ่มใหม่</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-150 flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'active'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <Activity size={16} className={activeTab === 'active' ? 'animate-pulse' : ''} />
          <span>เวชภัณฑ์พร้อมใช้งาน (Active)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold font-mono transition-colors ${
            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}>
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inactive')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'inactive'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/15 scale-102 -translate-y-0.5'
              : 'bg-white border border-gray-200 text-gray-600 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/30'
          }`}
        >
          <XOctagon size={16} />
          <span>เวชภัณฑ์ที่ระงับใช้งาน (Is Not Active)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold font-mono transition-colors ${
            activeTab === 'inactive' ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-700 border border-orange-100'
          }`}>
            {inactiveCount}
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">รหัสเวชภัณฑ์</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">ชื่อสามัญ (Generic) / ชื่อย่อ (Abbreviation)</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100">รูปแบบ (Dosage)</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100 text-center">บรรจุภัณฑ์</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100 text-center">อัตราการใช้ (Manual)</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100 text-center">ราคาต่อหน่วย</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase border-b border-gray-100 text-center">สถานะ</th>
              <th className="px-4 py-4 text-xs font-extrabold text-gray-500 uppercase text-right border-b border-gray-100">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={8} className="p-10 text-center text-emerald-600 font-bold animate-pulse">กำลังโหลดข้อมูล...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={8} className="p-10 text-center text-gray-500 font-bold">ไม่พบรายการเวชภัณฑ์</td></tr>
            ) : (
              filteredProducts.map((item) => (
                <tr key={item.id} className={`hover:bg-emerald-50/50 transition-colors ${!item.is_active && 'opacity-60 bg-gray-50'}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                      {item.drug_code || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-900">{item.generic_name}</span>
                      <div className="flex flex-wrap gap-1">
                        {item.is_psycho_narco && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-bold">Narco</span>}
                        {item.is_high_alert && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-bold">HAD</span>}
                        {item.is_cold_storage && <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 text-[10px] rounded font-bold font-sans">Cold</span>}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">{item.abbreviation}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{item.master_dosage_forms?.name_en || '-'}</span>
                    <div className="text-xs text-gray-400">{item.master_product_types?.name || 'ไม่ระบุประเภท'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-700">{item.pack_size} x {item.master_units?.name || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-xl font-mono shadow-sm">
                      {item.manual_monthly_usage?.toLocaleString() || '0'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-gray-700">฿{item.unit_price?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        <Activity size={14} /> ใช้งาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                        <XOctagon size={14} /> ยกเลิก
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setBarcodePanelProduct({ id: item.id, name: item.generic_name })}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        title="จัดการบาร์โค้ด"
                      >
                        <QrCode size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(item.id, item.is_active ?? true)}
                        className={`p-2 rounded-lg transition-colors ${item.is_active ? 'text-orange-500 hover:bg-orange-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                        title={item.is_active ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                      >
                        {item.is_active ? <XOctagon size={18} /> : <Activity size={18} />}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.generic_name)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบออกจากระบบถาวร"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal เพิ่ม/แก้ไขยา */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-start overflow-y-auto p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-6 sm:p-8 animate-fade-in-up my-auto relative">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">{editingId ? 'แก้ไขข้อมูลเวชภัณฑ์' : 'เพิ่มรายการเวชภัณฑ์ใหม่'}</h2>
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">รหัสเวชภัณฑ์ (Drug Code) <span className="text-red-500">*ห้ามซ้ำ</span></label>
                <input
                  type="text" required value={formData.drug_code} onChange={e => setFormData({ ...formData, drug_code: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อสามัญ (Generic Name) <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-gray-900"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อย่อ (Abbreviation)</label>
                <input
                  type="text" value={formData.abbreviation} onChange={e => setFormData({ ...formData, abbreviation: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">รูปแบบเวชภัณฑ์ (Dosage Form)</label>
                <select
                  value={formData.dosage_form_id} onChange={e => setFormData({ ...formData, dosage_form_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {dosageForms.map(df => <option key={df.id} value={df.id}>{df.name_en} ({df.name_th})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ประเภทเวชภัณฑ์ (Product Type)</label>
                <select
                  value={formData.product_type_id} onChange={e => setFormData({ ...formData, product_type_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {productTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">จำนวนหน่วยนับ (Pack Size)</label>
                <input
                  type="number" min="1" required value={formData.pack_size} onChange={e => setFormData({ ...formData, pack_size: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อหน่วยนับ (Unit)</label>
                <select
                  value={formData.unit_id} onChange={e => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {units.map(un => <option key={un.id} value={un.id}>{un.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ราคาต่อหน่วย (Unit Price)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                  <input
                    type="number" min="0" step="0.01" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">อัตราการใช้เฉลี่ยต่อเดือน (Manual)</label>
                <input
                  type="number" min="0" value={formData.manual_monthly_usage} onChange={e => setFormData({ ...formData, manual_monthly_usage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none font-bold text-amber-800 font-mono"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-2 pb-2">
                <label className="block text-sm font-bold text-gray-700 mb-3">คุณสมบัติพิเศษ (Special Attributes)</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:bg-purple-50 hover:border-purple-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_psycho_narco}
                      onChange={e => setFormData({ ...formData, is_psycho_narco: e.target.checked })}
                      className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span className="text-sm font-bold text-gray-700">วัตถุออกฤทธิ์ต่อจิตประสาท/ยาเสพติด</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_high_alert}
                      onChange={e => setFormData({ ...formData, is_high_alert: e.target.checked })}
                      className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                    <span className="text-sm font-bold text-gray-700">High Alert Drug (HAD)</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_cold_storage}
                      onChange={e => setFormData({ ...formData, is_cold_storage: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-gray-700">ยาเก็บในตู้เย็น (Cold Storage)</span>
                  </label>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 pt-6 flex gap-3 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">
                  บันทึกข้อมูลเวชภัณฑ์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (importStep !== 'importing') {
              setIsImportModalOpen(false);
              setImportStep('upload');
            }
          }}
        >
          <div
            className={`bg-white rounded-3xl shadow-xl w-full ${importStep === 'preview' ? 'max-w-4xl' : 'max-w-2xl'} p-6 sm:p-8 animate-fade-in-up max-h-[90vh] flex flex-col transition-all duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900">
                    {importStep === 'upload' && 'นำเข้าข้อมูลเวชภัณฑ์ (Excel / CSV)'}
                    {importStep === 'preview' && 'ตัวอย่างข้อมูลที่จะนำเข้า (Import Preview)'}
                    {importStep === 'importing' && 'กำลังดำเนินการนำเข้าเวชภัณฑ์...'}
                    {importStep === 'summary' && 'สรุปผลการนำเข้าข้อมูลเวชภัณฑ์'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {importStep === 'upload' && 'ทำตามขั้นตอนด้านล่างเพื่อทำการเพิ่มเวชภัณฑ์จำนวนมากจากไฟล์สเปรดชีต'}
                    {importStep === 'preview' && 'ตรวจสอบและยืนยันความสมบูรณ์ของข้อมูลก่อนบันทึกสู่ระบบ'}
                    {importStep === 'importing' && 'กรุณาห้ามปิดหน้าต่างนี้ จนกว่าการนำเข้าทั้งหมดจะเสร็จสิ้น'}
                    {importStep === 'summary' && 'ระบบได้ทำรายการบันทึกสู่ระบบและตรวจสอบข้อมูลเสร็จสิ้นแล้ว'}
                  </p>
                </div>
              </div>
              {importStep !== 'importing' && (
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportStep('upload');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-6 pr-1">
              
              {/* STEP 1: Upload File */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  {/* Step 1.1: Download Template */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-extrabold text-sm border border-emerald-200">
                      1
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900">ดาวน์โหลดไฟล์ต้นแบบ (Template)</h4>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">กรุณาใช้ไฟล์ต้นแบบที่ระบบกำหนด เพื่อการประมวลผลคอลัมน์ที่สมบูรณ์และถูกต้อง (ไฟล์ CSV ของระบบมีการใส่ BOM เพื่อรองรับภาษาไทยใน Excel แล้ว)</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={downloadExcelTemplate}
                          className="inline-flex items-center gap-2 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                        >
                          <Download size={16} />
                          <span>ดาวน์โหลดไฟล์ต้นแบบ (.xlsx)</span>
                        </button>
                        <button
                          onClick={downloadCsvTemplate}
                          className="inline-flex items-center gap-2 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                        >
                          <Download size={16} />
                          <span>ดาวน์โหลดไฟล์ต้นแบบ (.csv)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Step 1.2: Prepare Data */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-extrabold text-sm border border-emerald-200">
                      2
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900">กรอกข้อมูลและเตรียมไฟล์</h4>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">ข้อกำหนดและข้อแนะนำสำหรับการกรอกข้อมูลเวชภัณฑ์:</p>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-900 space-y-2 font-medium">
                        <div className="flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5"></span>
                          <span>คอลัมน์ <strong>drug_code</strong> และ <strong>generic_name</strong> ห้ามเป็นค่าว่าง</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5"></span>
                          <span>รหัสเวชภัณฑ์ (drug_code) ต้องไม่มีซ้ำในฐานข้อมูลระบบ</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5"></span>
                          <span>ระบบรองรับการ <strong>สร้างรายการตัวเลือกใหม่อัตโนมัติ (Auto-Lookup)</strong> หาก ชื่อย่อรูปแบบเวชภัณฑ์, ประเภทเวชภัณฑ์ หรือหน่วยนับ ที่ท่านระบุไม่มีในระบบ ระบบจะสร้างให้ทันทีโดยไม่มีการแจ้งปฏิเสธ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Step 1.3: Upload File */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-extrabold text-sm border border-emerald-200">
                      3
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900">อัปโหลดและประมวลผลข้อมูล</h4>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">เลือกไฟล์ Excel หรือ CSV ที่กรอกข้อมูลเรียบร้อยแล้วเพื่อส่งให้ระบบวิเคราะห์และนำเข้า</p>
                      </div>

                      {isImporting ? (
                        <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-2xl p-8 text-center space-y-3">
                          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <div className="font-bold text-emerald-800 text-sm">กำลังนำเข้าและตรวจสอบข้อมูล...</div>
                          <div className="text-xs text-emerald-600 font-medium">กรุณาอย่าเพิ่งปิดหน้าต่างนี้จนกว่าการประมวลผลจะเสร็จสิ้น</div>
                        </div>
                      ) : (
                        <label className="group block border-2 border-dashed border-gray-200 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all">
                          <div className="p-3 bg-white shadow-sm border border-gray-100 text-gray-400 group-hover:text-emerald-600 rounded-xl inline-block mb-3 transition-colors">
                            <Upload size={24} />
                          </div>
                          <div className="font-bold text-gray-700 text-sm group-hover:text-emerald-800 transition-colors">คลิกที่นี่เพื่อเลือกไฟล์ Excel หรือ CSV</div>
                          <div className="text-xs text-gray-400 mt-1 font-medium">รองรับเฉพาะไฟล์ .xlsx, .xls และ .csv เท่านั้น</div>
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleExcelImport}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Preview Summary */}
              {importStep === 'preview' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                      <div className="text-xs font-bold text-gray-400 uppercase">เวชภัณฑ์ทั้งหมดในไฟล์</div>
                      <div className="text-2xl font-black text-gray-800 mt-1">{parsedItems.length}</div>
                    </div>
                    <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-center">
                      <div className="text-xs font-bold text-emerald-700 uppercase">พร้อมนำเข้าสำเร็จ</div>
                      <div className="text-2xl font-black text-emerald-700 mt-1">
                        {parsedItems.filter(i => i.validationStatus === 'ready').length}
                      </div>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                      <div className="text-xs font-bold text-amber-800 uppercase">จะถูกข้าม (ไม่ถูกต้อง)</div>
                      <div className="text-2xl font-black text-amber-800 mt-1">
                        {parsedItems.filter(i => i.validationStatus === 'error').length}
                      </div>
                    </div>
                  </div>

                  {/* Preview Scrollable Table */}
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 mb-2">ตารางพรีวิวรายการเวชภัณฑ์</h4>
                    <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2.5 font-bold text-gray-500 w-12 text-center">แถว</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500">รหัส (drug_code)</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500">ชื่อสามัญ (generic_name)</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500">ชื่อย่อรูปแบบ</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500 text-right">ราคาต่อหน่วย</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500 text-right">การใช้เฉลี่ย</th>
                            <th className="px-3 py-2.5 font-bold text-gray-500 text-center">สถานะความพร้อม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parsedItems.map((item, idx) => (
                            <tr key={idx} className={`hover:bg-gray-50/50 ${item.validationStatus === 'error' && 'bg-amber-50/30'}`}>
                              <td className="px-3 py-2.5 text-center text-gray-400 font-mono font-medium">{item.rowNum}</td>
                              <td className="px-3 py-2.5 font-mono font-bold text-gray-700">{item.drugCode || '-'}</td>
                              <td className="px-3 py-2.5 font-bold text-gray-800">{item.genericName || '-'}</td>
                              <td className="px-3 py-2.5 text-gray-600">{item.dosageFormName || '-'}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-gray-700">฿{item.unitPrice.toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-800">{item.manualMonthlyUsage.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-center">
                                {item.validationStatus === 'ready' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    พร้อมนำเข้า
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800" title={item.errorMessage}>
                                    ไม่สมบูรณ์
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setParsedItems([]);
                        setImportStep('upload');
                      }}
                      className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                    >
                      ยกเลิกกลับไปเริ่มต้น
                    </button>
                    <button
                      onClick={startImporting}
                      className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 hover:shadow-lg transition-all text-sm"
                    >
                      ยืนยันเริ่มนำเข้า ({parsedItems.filter(i => i.validationStatus === 'ready').length} รายการ)
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Importing (Progress) */}
              {importStep === 'importing' && (
                <div className="py-8 space-y-6 text-center">
                  <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  
                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-gray-800">กำลังดำเนินการบันทึกข้อมูลเข้าฐานข้อมูล...</h4>
                    <p className="text-xs text-gray-500 font-medium">แถวที่ {importProgress.current} จากทั้งหมด {importProgress.total} แถว</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden border border-gray-200/50 shadow-inner max-w-md mx-auto">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${Math.max(2, Math.round((importProgress.current / importProgress.total) * 100))}%` }}
                    ></div>
                  </div>

                  {/* Counters */}
                  <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto pt-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase">นำเข้าสำเร็จ</div>
                      <div className="text-xl font-black text-emerald-800 mt-0.5">{importProgress.success}</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-amber-800 uppercase">ข้ามหรือมีข้อผิดพลาด</div>
                      <div className="text-xl font-black text-amber-800 mt-0.5">{importProgress.skip}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Complete Summary */}
              {importStep === 'summary' && (
                <div className="space-y-6 text-center py-4">
                  {/* Success Circle */}
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-md">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-gray-900">การนำเข้าข้อมูลเวชภัณฑ์เสร็จสิ้นสมบูรณ์!</h4>
                    <p className="text-xs text-gray-500 font-medium">ระบบได้อัปเดตสต๊อกและฐานข้อมูลเวชภัณฑ์เรียบร้อยแล้ว</p>
                  </div>

                  {/* Final Results */}
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto py-2">
                    <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                      <div className="text-xs font-bold text-emerald-800 uppercase">บันทึกสำเร็จทั้งหมด</div>
                      <div className="text-3xl font-black text-emerald-800 mt-1">{importResultSummary.success}</div>
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">รายการเวชภัณฑ์พร้อมใช้งาน</div>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <div className="text-xs font-bold text-amber-800 uppercase">ข้าม / ไม่ผ่านการตรวจสอบ</div>
                      <div className="text-3xl font-black text-amber-800 mt-1">{importResultSummary.skip}</div>
                      <div className="text-[10px] text-amber-600 font-bold mt-0.5">รายการเนื่องจากค่าว่างหรือซ้ำ</div>
                    </div>
                  </div>

                  {/* Scrollable Errors Box */}
                  {importResultSummary.errors.length > 0 && (
                    <div className="text-left max-w-xl mx-auto space-y-2">
                      <h5 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">รายละเอียดรายการที่ข้ามหรือมีข้อผิดพลาด ({importResultSummary.errors.length} แถว):</h5>
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-40 overflow-y-auto text-xs font-mono text-gray-600 divide-y divide-gray-100">
                        {importResultSummary.errors.map((err, idx) => (
                          <div key={idx} className="py-1.5 first:pt-0 last:pb-0 text-red-600 font-semibold">{err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Finish Action Button */}
                  <div className="pt-4 max-w-sm mx-auto">
                    <button
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setImportStep('upload');
                        setParsedItems([]);
                      }}
                      className="w-full px-6 py-3 bg-emerald-700 text-white font-extrabold rounded-2xl hover:bg-emerald-850 hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm cursor-pointer"
                    >
                      เสร็จสิ้นการนำเข้าข้อมูล
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer (Only shown in Step 1) */}
            {importStep === 'upload' && (
              <div className="pt-4 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Barcode Management Modal */}
      {barcodePanelProduct && (
        <ProductBarcodeModal
          productId={barcodePanelProduct.id}
          productName={barcodePanelProduct.name}
          onClose={() => setBarcodePanelProduct(null)}
        />
      )}
    </div>
  );
}
