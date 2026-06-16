import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Plus, Trash2, Star, Camera, ScanLine, Loader2, QrCode } from 'lucide-react';
import { ProductBarcode, BarcodeType } from '@/types';

// ============================================================
// Types
// ============================================================
interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
  { value: 'EAN13',     label: 'EAN-13 (ทั่วไป)' },
  { value: 'Code128',   label: 'Code 128' },
  { value: 'QR',        label: 'QR Code' },
  { value: 'GS1-128',   label: 'GS1-128 (ยา/อุปกรณ์การแพทย์)' },
  { value: 'DataMatrix', label: 'Data Matrix' },
  { value: 'Other',     label: 'อื่นๆ' },
];

function detectBarcodeType(barcode: string): BarcodeType {
  const trimmed = barcode.trim();
  
  // 1. URL or typical QR structure
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('|') || trimmed.startsWith('{')) {
    return 'QR';
  }
  
  // 2. GS1-128 or GS1 DataMatrix (contains (01) or starts with 01 followed by 14 digits)
  if (/(?:\(01\)|^01)\d{14}/.test(trimmed)) {
    return 'GS1-128';
  }
  
  // 3. EAN-13 (13 digits)
  if (/^\d{13}$/.test(trimmed)) {
    return 'EAN13';
  }
  
  // 4. Code 128 (general alphanumeric 1D barcode)
  if (/^[A-Za-z0-9\-_]{4,30}$/.test(trimmed)) {
    return 'Code128';
  }
  
  return 'Other';
}

const EMPTY_FORM = { barcode: '', trade_name: '', barcode_type: 'EAN13' as BarcodeType, notes: '' };

// ============================================================
// Component
// ============================================================
export default function ProductBarcodeModal({ productId, productName, onClose }: Props) {
  const [barcodes, setBarcodes]     = useState<ProductBarcode[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [scanActive, setScanActive] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const scannerRef  = useRef<any>(null);
  const scanDivId   = 'barcode-scanner-modal';

  // ---- Fetch barcodes for this product ----
  const fetchBarcodes = async () => {
    setIsLoading(true);
    const { data, error: err } = await supabase
      .from('product_barcodes')
      .select('*')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (!err && data) setBarcodes(data as ProductBarcode[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchBarcodes(); }, [productId]);

  // ---- Scanner ----
  useEffect(() => {
    if (!scanActive) return;

    let scanner: any = null;
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        const element = document.getElementById(scanDivId);
        if (!element) {
          console.error("Scanner element not found in DOM");
          return;
        }
        scanner = new Html5Qrcode(scanDivId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { 
            fps: 15, 
            aspectRatio: 1.777778,
            qrbox: (w: number, h: number) => {
              const size = Math.min(w, h);
              return { width: size * 0.85, height: size * 0.45 };
            },
            videoConstraints: {
              focusMode: 'continuous',
              advanced: [{ focusMode: 'continuous' }]
            }
          },
          (decodedText: string) => {
            const val = decodedText.trim();
            const autoType = detectBarcodeType(val);
            setForm(prev => ({
              ...prev,
              barcode: val,
              barcode_type: autoType,
            }));
            setScanActive(false);
          },
          () => {}
        );

        // Apply continuous autofocus constraints once stream is active
        setTimeout(() => {
          if (scanner && scanner.isScanning) {
            scanner.applyVideoConstraints({
              focusMode: 'continuous',
              advanced: [{ focusMode: 'continuous' }]
            }).catch((err: any) => console.debug("Apply autofocus constraints failed:", err));
          }
        }, 1000);
      } catch (e) {
        console.error("Failed to start scanner:", e);
        setScanActive(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scanner?.isScanning) {
        scanner.stop().catch(console.error);
      }
      scannerRef.current = null;
    };
  }, [scanActive]);

  const startScanner = () => {
    setScanActive(true);
  };

  const stopScanner = () => {
    setScanActive(false);
  };

  // ---- Add barcode ----
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.barcode.trim()) { setError('กรุณาระบุค่าบาร์โค้ด'); return; }

    setIsSaving(true);
    const isFirst = barcodes.length === 0;

    const { error: err } = await supabase.from('product_barcodes').insert([{
      product_id:   productId,
      barcode:      form.barcode.trim(),
      trade_name:   form.trade_name.trim() || null,
      barcode_type: form.barcode_type,
      notes:        form.notes.trim() || null,
      is_primary:   isFirst, // บาร์โค้ดแรก = primary อัตโนมัติ
    }]);

    if (err) {
      if (err.code === '23505') setError('บาร์โค้ดนี้มีในระบบแล้ว (ซ้ำกับรายการอื่น)');
      else setError(err.message);
    } else {
      setForm(EMPTY_FORM);
      await fetchBarcodes();
    }
    setIsSaving(false);
  };

  // ---- Delete barcode ----
  const handleDelete = async (id: string, bc: string) => {
    if (!window.confirm(`ลบบาร์โค้ด "${bc}" ออกจากระบบ?`)) return;
    await supabase.from('product_barcodes').delete().eq('id', id);
    await fetchBarcodes();
  };

  // ---- Set primary ----
  const handleSetPrimary = async (id: string) => {
    // ล้าง is_primary ทั้งหมดของสินค้านี้ก่อน
    await supabase.from('product_barcodes').update({ is_primary: false }).eq('product_id', productId);
    await supabase.from('product_barcodes').update({ is_primary: true }).eq('id', id);
    await fetchBarcodes();
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">จัดการบาร์โค้ด</h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-xs">{productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ---- Add Form ---- */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
            <h4 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={16} className="text-emerald-600" />
              เพิ่มบาร์โค้ดใหม่
            </h4>

            <form onSubmit={handleAdd} className="space-y-3">
              {/* Barcode + Scan button */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1">ค่าบาร์โค้ด <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="ระบุหรือกด Scan"
                    value={form.barcode}
                    onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={scanActive ? stopScanner : startScanner}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      scanActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {scanActive ? <X size={16} /> : <Camera size={16} />}
                    {scanActive ? 'หยุด' : 'Scan'}
                  </button>
                </div>
              </div>

              {/* Camera preview */}
              {scanActive && (
                <div className="rounded-2xl overflow-hidden border-2 border-emerald-400 bg-black shadow-inner">
                  <div id={scanDivId} className="w-full" style={{ minHeight: 180 }} />
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-700/90 text-white text-xs font-bold">
                    <ScanLine size={14} className="animate-pulse" />
                    กำลังสแกนบาร์โค้ด...
                  </div>
                </div>
              )}

              {/* Trade Name + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">ชื่อการค้า / ยี่ห้อ</label>
                  <input
                    type="text"
                    placeholder="เช่น Sara, Tylenol"
                    value={form.trade_name}
                    onChange={e => setForm(prev => ({ ...prev, trade_name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">ประเภทบาร์โค้ด</label>
                  <select
                    value={form.barcode_type}
                    onChange={e => setForm(prev => ({ ...prev, barcode_type: e.target.value as BarcodeType }))}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none"
                  >
                    {BARCODE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">หมายเหตุ (ถ้ามี)</label>
                <input
                  type="text"
                  placeholder="เช่น แผงละ 10 เม็ด, กล่องใหญ่"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none"
                />
              </div>

              {error && (
                <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl">
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60 text-sm"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  เพิ่มบาร์โค้ด
                </button>
              </div>
            </form>
          </div>

          {/* ---- Barcode List ---- */}
          <div>
            <h4 className="text-sm font-extrabold text-gray-800 mb-3">
              บาร์โค้ดที่ลงทะเบียนแล้ว
              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-mono">
                {barcodes.length} รายการ
              </span>
            </h4>

            {isLoading ? (
              <div className="text-center py-8 text-emerald-600 font-bold text-sm animate-pulse">
                กำลังโหลด...
              </div>
            ) : barcodes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <QrCode size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400 font-bold">ยังไม่มีบาร์โค้ดสำหรับเวชภัณฑ์นี้</p>
                <p className="text-xs text-gray-300 mt-1">ใช้ฟอร์มด้านบนเพื่อเพิ่มบาร์โค้ด</p>
              </div>
            ) : (
              <div className="space-y-2">
                {barcodes.map(bc => (
                  <div
                    key={bc.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      bc.is_primary
                        ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Primary badge */}
                    <div className="flex-shrink-0">
                      {bc.is_primary ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-[10px] font-extrabold rounded-lg">
                          <Star size={10} fill="white" /> หลัก
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetPrimary(bc.id)}
                          title="ตั้งเป็นบาร์โค้ดหลัก"
                          className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <Star size={16} />
                        </button>
                      )}
                    </div>

                    {/* Barcode info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-gray-800 text-sm">{bc.barcode}</span>
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-bold border border-gray-200">
                          {bc.barcode_type || 'EAN13'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {bc.trade_name && (
                          <span className="text-xs text-emerald-700 font-bold">{bc.trade_name}</span>
                        )}
                        {bc.notes && (
                          <span className="text-xs text-gray-400">{bc.notes}</span>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(bc.id, bc.barcode)}
                      className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบบาร์โค้ด"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
