import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Borrowing } from '@/types';
import { useParams, useNavigate } from 'react-router-dom';
import { useOfficers } from '@/hooks/useOfficers';
import { ArrowLeftRight, CheckCircle2, Save, RotateCcw, ArrowLeft } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { DatePicker } from '@/components/ui/DatePicker';

export default function ReturnForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { officers } = useOfficers();
  
  const [borrowing, setBorrowing] = useState<Borrowing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [returnQty, setReturnQty] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>('');

  useEffect(() => {
    const fetchBorrowing = async () => {
      try {
        const { data, error } = await supabase
          .from('borrowings')
          .select(`
            *,
            products ( generic_name, trade_name ),
            officers ( full_name ),
            master_warehouses ( name )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setBorrowing(data);
        setWarehouseId(data.warehouse_id || '');
      } catch (err: any) {
        console.error(err);
        alert('ดึงข้อมูลการยืมล้มเหลว: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchBorrowing();
  }, [id]);

  const handleSaveReturn = async () => {
    if (!borrowing) return;
    
    if (returnQty === '' || returnQty <= 0) {
      alert('กรุณาระบุจำนวนที่คืนให้ถูกต้อง');
      return;
    }
    
    const pendingQty = borrowing.borrowed_qty - borrowing.returned_qty;
    if (returnQty > pendingQty) {
      alert(`ไม่สามารถคืนเกินจำนวนที่ค้างอยู่ได้ (ค้างอยู่ ${pendingQty})`);
      return;
    }
    
    if (!lotNumber || !expiryDate) {
      alert('กรุณาระบุ Lot Number และ วันหมดอายุ ของยาที่นำมาคืนให้ครบถ้วน');
      return;
    }

    if (!confirm(`ยืนยันการรับคืนเวชภัณฑ์จำนวน ${returnQty} เข้าสู่คลัง?`)) return;

    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ไม่พบเซสชั่นการล็อกอิน");

      const creator = officers.find(s => s.id === user.id);

      // 1. Create Stock Movement (Type: RETURN)
      const { data: movement, error: movError } = await supabase
        .from('stock_movements')
        .insert({
          movement_type: 'RETURN',
          to_warehouse_id: warehouseId,
          created_by: user.id,
          created_by_position: creator?.position || null
        })
        .select('id')
        .single();
      
      if (movError) throw movError;

      // 2. ค้นหาหรือสร้าง Lot ใหม่จากการคืน
      const { data: lotId, error: lotError } = await supabase.rpc('find_or_create_lot', {
          p_product_id: borrowing.product_id,
          p_lot_number: lotNumber,
          p_expiry_date: expiryDate,
          p_unit_price: 0
      });
      if (lotError) throw lotError;

      // 3. Insert Stock Movement Item
      const { error: itemsError } = await supabase
        .from('stock_movement_items')
        .insert({
          movement_id: movement.id,
          product_id: borrowing.product_id,
          lot_id: lotId,
          qty: returnQty,
          pack_size: (borrowing as any).pack_size || 1,
          unit_name: (borrowing as any).unit_name || ''
        });

      if (itemsError) throw itemsError;

      // 3. Update Borrowing Record
      const newReturnedQty = borrowing.returned_qty + Number(returnQty);
      const newStatus = newReturnedQty >= borrowing.borrowed_qty ? 'COMPLETED' : 'PARTIAL';
      
      const { error: updateError } = await supabase
        .from('borrowings')
        .update({ 
          returned_qty: newReturnedQty,
          status: newStatus
        })
        .eq('id', borrowing.id);

      if (updateError) throw updateError;

      setSuccessMsg('บันทึกรับคืนเวชภัณฑ์สำเร็จ!');
      
      setTimeout(() => {
        navigate('/borrow');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 font-bold">กำลังโหลดข้อมูล...</div>;
  }

  if (!borrowing) {
    return <div className="p-8 text-center text-red-500 font-bold">ไม่พบข้อมูลการยืมรหัสนี้</div>;
  }

  const pendingQty = borrowing.borrowed_qty - borrowing.returned_qty;

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
            <RotateCcw size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">รับคืนเวชภัณฑ์</h1>
            <p className="text-gray-500 font-medium text-sm mt-0.5">ระบุรายละเอียดล็อตของยาที่ส่งคืนเข้าคลัง</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/borrow')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-800 font-bold transition-colors"
        >
          <ArrowLeft size={18} /> กลับไปหน้าระบบยืม-คืน
        </button>
      </div>

      {successMsg && (
        <Alert type="success" message={successMsg} />
      )}

      {/* Borrowing Info Card */}
      <Card>
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-1 space-y-4">
            <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">ผู้ยืม</p>
            <p className="font-bold text-gray-800">{borrowing.officers?.full_name}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">เวชภัณฑ์ที่ยืม</p>
            <p className="font-bold text-emerald-700 text-lg leading-tight">
              {borrowing.products?.generic_name}
            </p>
            <p className="text-sm text-gray-500 font-medium">
              {borrowing.products?.trade_name}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">คลังที่ทำรายการ</p>
            <p className="font-bold text-gray-800">{borrowing.master_warehouses?.name || '-'}</p>
          </div>
        </div>

        <div className="flex-1 bg-amber-50 p-6 rounded-2xl border border-amber-100 w-full flex flex-col justify-center items-center text-center">
          <p className="text-sm font-bold text-amber-700 mb-1">ยอดที่ต้องส่งคืน (ค้างส่ง)</p>
          <p className="text-5xl font-black text-amber-600 mb-2">{pendingQty}</p>
          <div className="flex gap-4 text-xs font-bold text-amber-800/60">
            <span>ยืมไปรวม: {borrowing.borrowed_qty}</span>
            <span>คืนแล้ว: {borrowing.returned_qty}</span>
          </div>
        </div>
        </div>
      </Card>

      {/* Return Form */}
      {pendingQty > 0 ? (
        <Card>
          <CardHeader title="กรอกข้อมูลยาที่นำมาคืน" icon={<ArrowLeftRight size={18} />} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <Input
              label="Lot Number ที่รับคืนมา"
              required
              value={lotNumber}
              onChange={e => setLotNumber(e.target.value)}
              placeholder="เช่น L24001"
              className="uppercase"
            />
            
            <div className="space-y-1.5 w-full">
              <label className="block text-sm font-bold text-gray-700">วันหมดอายุ (ของล็อตที่คืน) <span className="text-red-500">*</span></label>
              <DatePicker
                value={expiryDate}
                onChange={setExpiryDate}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all text-sm font-medium shadow-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
              />
            </div>
            
            <Input
              label={`จำนวนที่คืน (คืนได้สูงสุด ${pendingQty})`}
              type="number"
              min="1"
              max={pendingQty}
              required
              value={returnQty}
              onChange={e => setReturnQty(e.target.value === '' ? '' : parseInt(e.target.value))}
              placeholder="0"
              className="text-center text-blue-700 font-black text-lg"
            />
          </div>

          <div className="pt-6 flex justify-end">
            <Button
              onClick={handleSaveReturn}
              disabled={isSubmitting}
              icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
              size="lg"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรับคืนเวชภัณฑ์'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-emerald-800 mb-2">รายการนี้คืนครบถ้วนแล้ว</h2>
          <p className="text-emerald-600/80 font-medium">ไม่มียอดค้างชำระสำหรับรายการยืมรหัสนี้</p>
        </div>
      )}

    </div>
  );
}
