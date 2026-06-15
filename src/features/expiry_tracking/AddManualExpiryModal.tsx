import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductSearchResult } from '@/types';
import { X, Save, AlertCircle, RefreshCw } from 'lucide-react';
import ProductSearchInput from '@/components/ProductSearchInput';
import { useWarehouses } from '@/hooks/useWarehouses';

interface AddManualExpiryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddManualExpiryModal({ onClose, onSuccess }: AddManualExpiryModalProps) {
  const { warehouses } = useWarehouses();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [manufacturer, setManufacturer] = useState('');
  const [remark, setRemark] = useState('');

  const [suggestedLots, setSuggestedLots] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Set default warehouse
  useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // Load suggested lots when a product is selected
  useEffect(() => {
    const fetchLotSuggestions = async () => {
      if (!selectedProduct) {
        setSuggestedLots([]);
        return;
      }
      
      setIsLoadingSuggestions(true);
      // Fetch distinct lots for this product from the lots table
      const { data, error } = await supabase
        .from('lots')
        .select('lot_number, expiry_date')
        .eq('product_id', selectedProduct.id)
        .order('expiry_date', { ascending: false });
        
      if (data) {
        // Remove duplicates by lot_number
        const uniqueLots = Array.from(new Map(data.map(item => [item.lot_number, item])).values());
        setSuggestedLots(uniqueLots);
      }
      setIsLoadingSuggestions(false);
    };

    fetchLotSuggestions();
  }, [selectedProduct]);

  const handleSelectSuggestion = (lot: any) => {
    setLotNumber(lot.lot_number);
    if (lot.expiry_date) {
      // Format YYYY-MM-DD
      setExpiryDate(lot.expiry_date.split('T')[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('กรุณาเลือกเวชภัณฑ์');
      return;
    }
    if (!expiryDate) {
      alert('กรุณาระบุวันหมดอายุ');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { error } = await supabase.from('manual_expirations').insert([{
        product_id: selectedProduct.id,
        lot_number: lotNumber || null,
        expiry_date: expiryDate,
        qty: qty === '' ? null : Number(qty),
        warehouse_id: warehouseId,
        manufacturer: manufacturer || null,
        remark: remark || null,
        created_by: userId
      }]);

      if (error) throw error;
      
      onSuccess();
    } catch (err: any) {
      console.error('Error saving manual expiration:', err);
      alert('บันทึกข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto py-10">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <AlertCircle size={22} />
              เพิ่มรายการยาติดตามวันหมดอายุ
            </h2>
            <p className="text-emerald-100 text-sm mt-1">เพิ่มรายการเวชภัณฑ์ที่เบิกไปแล้ว เพื่อติดตามวันหมดอายุ</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Product Search */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ค้นหาเวชภัณฑ์</label>
              {!selectedProduct ? (
                <ProductSearchInput
                  onSelect={setSelectedProduct}
                  placeholder="พิมพ์ชื่อยา หรือรหัส เพื่อค้นหา..."
                  autoFocus
                />
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-emerald-900">{selectedProduct.generic_name}</span>
                    <span className="text-xs text-emerald-600 font-bold mt-0.5">
                      รหัส: {selectedProduct.drug_code || '-'} {selectedProduct.trade_name && `• ${selectedProduct.trade_name}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      setLotNumber('');
                      setExpiryDate('');
                    }}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Warehouse Select */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">สถานที่ (คลัง / ชั้นจุดจ่าย)</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold text-gray-800"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Suggestions */}
            {selectedProduct && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw size={16} className={`text-blue-500 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-bold text-blue-900">รายการล็อตที่เคยมีในระบบ (คลิกเพื่อเลือก)</span>
                </div>
                
                {isLoadingSuggestions ? (
                  <div className="text-xs text-blue-600 font-medium">กำลังโหลดข้อมูล...</div>
                ) : suggestedLots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestedLots.map((lot, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(lot)}
                        className="px-3 py-1.5 bg-white border border-blue-200 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-700 transition-colors shadow-sm"
                      >
                        Lot: {lot.lot_number || '-'} (EXP: {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('th-TH') : '-'})
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-blue-600 font-medium">ไม่พบประวัติล็อตในระบบ สามารถกรอกข้อมูลเองได้เลย</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Lot Number */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">เลขล็อต (Lot Number)</label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  placeholder="ถ้ามี"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">วันหมดอายุ <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">จำนวนคงเหลือบนชั้น (ถ้ามี)</label>
                <input
                  type="number"
                  min="0"
                  value={qty}
                  onChange={e => setQty(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="จำนวนหน่วย"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold text-lg"
                />
              </div>
              
              {/* Manufacturer */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ผู้ผลิต (ถ้ามี)</label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="เช่น GPO, Berlin"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            {/* Remark */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">หมายเหตุ</label>
              <input
                type="text"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="คำอธิบายเพิ่มเติม..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedProduct}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                บันทึกรายการ
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
