import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProductSearchInput from '@/components/ProductSearchInput';
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react';

export default function ReceiveForm() {
  const [product, setProduct] = useState<any>(null);
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !lot || !expiry || !qty) return alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบเซสชั่นการล็อกอิน");

      // 1. Insert Movement (RECEIVE)
      const { data: movement, error: movError } = await supabase.from('stock_movements').insert({
        movement_type: 'RECEIVE',
        created_by: user.id
      }).select('id').single();
      
      if (movError) throw movError;

      // 2. Insert Items -> Trigger จะเอาไปเพิ่มสต๊อกให้เอง
      const { error: itemError } = await supabase.from('stock_movement_items').insert({
        movement_id: movement.id,
        product_id: product.id,
        lot_number: lot,
        expiry_date: expiry,
        qty: parseInt(qty)
      });

      if (itemError) throw itemError;

      setSuccessMsg(`รับยา ${product.generic_name} จำนวน ${qty} เข้าคลังสำเร็จ!`);
      setProduct(null);
      setLot('');
      setExpiry('');
      setQty('');
      
      // ลบข้อความแจ้งเตือนเมื่อผ่านไป 5 วินาที
      setTimeout(() => setSuccessMsg(''), 5000);
      
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      
      {successMsg && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in-up">
          <CheckCircle2 className="text-emerald-500" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-10 relative overflow-hidden">
        
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-100 rounded-full blur-3xl opacity-50"></div>

        <div className="mb-10 relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <ArrowDownToLine size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">รับยาเข้าคลัง</h1>
            <p className="text-gray-500 font-medium mt-1">บันทึกรับยาใหม่เข้าคลังย่อย (Receive)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-extrabold text-gray-700 mb-2">1. ค้นหาและเลือกยา</label>
            <div className="relative">
              {product ? (
                <div className="flex items-center justify-between p-4 border-2 border-emerald-400 bg-emerald-50/50 rounded-2xl shadow-sm transition-all">
                  <div>
                    <p className="font-extrabold text-emerald-900 text-lg">{product.generic_name}</p>
                    <p className="text-sm text-emerald-700 font-medium mt-1">รหัส: {product.drug_code}</p>
                  </div>
                  <button type="button" onClick={() => setProduct(null)} className="px-4 py-2 bg-white text-red-500 text-sm font-bold rounded-xl shadow-sm hover:bg-red-50 transition-colors">
                    เปลี่ยนยา
                  </button>
                </div>
              ) : (
                <ProductSearchInput onSelect={setProduct} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <div>
              <label className="block text-sm font-extrabold text-gray-700 mb-2">2. Lot Number</label>
              <input 
                type="text" required value={lot} onChange={e => setLot(e.target.value)}
                placeholder="Ex. L23091A"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-extrabold text-gray-700 mb-2">3. วันหมดอายุ (Expiry)</label>
              <input 
                type="date" required value={expiry} onChange={e => setExpiry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-gray-700 mb-2">4. จำนวนรับเข้า (Quantity)</label>
            <input 
              type="number" min="1" required value={qty} onChange={e => setQty(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-2xl font-extrabold text-emerald-700 text-center"
            />
          </div>

          <button 
            type="submit" disabled={isSubmitting || !product}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-0.5 focus:ring-4 focus:ring-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg mt-4"
          >
            {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'บันทึกรับเข้าคลัง'}
          </button>
        </form>
      </div>
    </div>
  );
}
