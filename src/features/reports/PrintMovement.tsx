import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Printer, ArrowLeft, Ban } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PrintMovement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movement, setMovement] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchMovementData = async () => {
      setIsLoading(true);
      try {
        const { data: mov, error: movError } = await supabase
          .from('stock_movements')
          .select(`
            *
          `)
          .eq('id', id)
          .single();

        if (movError) throw movError;

        const { data: movItems, error: itemsError } = await supabase
          .from('stock_movement_items')
          .select(`
            *,
            product:products(drug_code, generic_name, unit_id:unit_id(name:unit_name)),
            lots (lot_number, expiry_date)
          `)
          .eq('movement_id', id);

        if (itemsError) throw itemsError;

        // Fetch officer details separately to avoid schema cache relationship issues
        const officerIds = [mov.actor_id, mov.created_by, mov.voided_by].filter(Boolean);
        let officersMap: Record<string, string> = {};
        
        if (officerIds.length > 0) {
          const { data: officersData } = await supabase
            .from('officers')
            .select('id, full_name')
            .in('id', officerIds);
            
          if (officersData) {
            officersData.forEach((o: any) => {
              officersMap[o.id] = o.full_name;
            });
          }
        }

        // Attach officer names back to movement object
        mov.actor = { full_name: officersMap[mov.actor_id] || mov.receiver || mov.dispenser_main_warehouse || '' };
        mov.created_by_user = { full_name: officersMap[mov.created_by] || '' };
        mov.voided_by_user = { full_name: officersMap[mov.voided_by] || '' };

        // Fetch warehouse details
        const warehouseIds = [mov.from_warehouse_id, mov.to_warehouse_id].filter(Boolean);
        let warehousesMap: Record<string, string> = {};
        if (warehouseIds.length > 0) {
          const { data: warehouseData } = await supabase
            .from('master_warehouses')
            .select('id, name')
            .in('id', warehouseIds);
          if (warehouseData) {
            warehouseData.forEach((w: any) => {
              warehousesMap[w.id] = w.name;
            });
          }
        }
        mov.from_warehouse = { name: warehousesMap[mov.from_warehouse_id] || '' };
        mov.to_warehouse = { name: warehousesMap[mov.to_warehouse_id] || '' };

        // Fetch requisition detail
        if (mov.requisition_id) {
          const { data: reqData } = await supabase
            .from('requisitions')
            .select('doc_no')
            .eq('id', mov.requisition_id)
            .single();
          mov.requisition = { doc_no: reqData?.doc_no || '' };
        } else {
          mov.requisition = null;
        }

        setMovement(mov);
        setItems(movItems || []);
      } catch (err: any) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovementData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-emerald-600 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="font-bold">กำลังโหลดเอกสาร...</p>
      </div>
    );
  }

  if (!movement) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-500 space-y-4">
        <p className="font-bold text-xl">ไม่พบเอกสารดังกล่าว</p>
        <Button onClick={() => navigate(-1)} variant="outline">กลับหน้าก่อนหน้า</Button>
      </div>
    );
  }

  const isReceive = movement.movement_type === 'RECEIVE';
  const isDispense = movement.movement_type === 'DISPENSE';
  const docTitle = isReceive ? 'ใบรับเข้าเวชภัณฑ์ (Receive Voucher)' : 
                   isDispense ? 'ใบเบิกจ่ายเวชภัณฑ์ (Dispense Voucher)' : 
                   'เอกสารความเคลื่อนไหวคลัง (Movement Voucher)';
  const docRef = movement.doc_no || `REF-${movement.id.substring(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:bg-white print:py-0 print:m-0 font-sans text-black">
      
      {/* Control Bar (Hidden in Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          icon={<ArrowLeft size={18} />}
        >
          กลับหน้ารายงาน
        </Button>
        <div className="flex gap-3">
          <Button 
            onClick={handlePrint}
            icon={<Printer size={18} />}
            className={isReceive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            พิมพ์เอกสาร
          </Button>
        </div>
      </div>

      {/* A4 Document Area */}
      <div className="max-w-4xl mx-auto bg-white p-10 sm:p-14 shadow-2xl print:shadow-none print:p-0 relative">
        
        {/* Void Watermark */}
        {movement.is_voided && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden opacity-10">
            <div className="transform -rotate-45 text-[150px] font-black text-red-600 border-[10px] border-red-600 px-10 py-5 rounded-3xl whitespace-nowrap">
              VOIDED
            </div>
          </div>
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black mb-2">{docTitle}</h1>
              <p className="text-gray-600 font-medium">โรงพยาบาลราชพิพัฒน์ (Rajpipat Hospital)</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xl font-bold font-mono">{docRef}</p>
              <p className="text-sm font-medium">วันที่ทำรายการ: {new Date(movement.created_at).toLocaleString('th-TH')}</p>
              {movement.is_voided && (
                <div className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded font-bold text-xs border border-red-300">
                  <Ban size={12} /> ถูกยกเลิกเมื่อ {formatDate(movement.voided_at)}
                </div>
              )}
            </div>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
            <div className="space-y-3">
              <div className="flex">
                <span className="w-32 font-bold text-gray-600">วันที่บนเอกสาร:</span>
                <span className="font-semibold">{formatDate(movement.doc_date)}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-bold text-gray-600">เอกสารอ้างอิง:</span>
                <span className="font-semibold">{movement.reference_doc_no || '-'}</span>
              </div>
              {movement.requisition_id && (
                <div className="flex">
                  <span className="w-32 font-bold text-gray-600">จากใบขอเบิกเลขที่:</span>
                  <span className="font-semibold text-blue-700">{movement.requisition?.doc_no || '-'}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex">
                <span className="w-28 font-bold text-gray-600">แหล่งที่มา/ไป:</span>
                <span className="font-semibold">{movement.source_location || '-'}</span>
              </div>
              {isReceive && (
                <div className="flex">
                  <span className="w-28 font-bold text-gray-600">คลังที่รับเข้า:</span>
                  <span className="font-semibold">{movement.to_warehouse?.name || '-'}</span>
                </div>
              )}
              {isDispense && (
                <div className="flex">
                  <span className="w-28 font-bold text-gray-600">คลังที่จ่ายออก:</span>
                  <span className="font-semibold">{movement.from_warehouse?.name || '-'}</span>
                </div>
              )}
              <div className="flex">
                <span className="w-28 font-bold text-gray-600">ผู้รับ/ผู้เบิก:</span>
                <span className="font-semibold">{movement.actor?.full_name || '-'}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm border-collapse mb-10">
            <thead>
              <tr className="border-y-2 border-gray-900 bg-gray-50/50 print:bg-transparent">
                <th className="py-3 px-2 text-center w-12 font-bold">ลำดับ</th>
                <th className="py-3 px-2 text-left font-bold">รหัส</th>
                <th className="py-3 px-2 text-left font-bold">รายการเวชภัณฑ์</th>
                <th className="py-3 px-2 text-left font-bold">Lot No.</th>
                <th className="py-3 px-2 text-left font-bold">Exp. Date</th>
                <th className="py-3 px-2 text-right font-bold">ราคา/หน่วย</th>
                <th className="py-3 px-2 text-right font-bold w-24">จำนวน</th>
                <th className="py-3 px-2 text-left font-bold">หน่วย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id} className="align-top">
                  <td className="py-3 px-2 text-center text-gray-600">{index + 1}</td>
                  <td className="py-3 px-2 font-mono text-gray-500">{item.product?.drug_code || '-'}</td>
                  <td className="py-3 px-2 font-bold text-gray-900">{item.product?.generic_name || '-'}</td>
                  <td className="py-3 px-2 font-mono">{item.lots?.lot_number || '-'}</td>
                  <td className="py-3 px-2">{item.lots?.expiry_date ? formatDate(item.lots?.expiry_date) : '-'}</td>
                  <td className="py-3 px-2 text-right">{item.unit_price ? Number(item.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                  <td className="py-3 px-2 text-right font-black text-lg">{Math.abs(item.qty).toLocaleString()}</td>
                  <td className="py-3 px-2 text-gray-600">{item.unit_name || item.product?.unit_id?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td colSpan={6} className="py-4 px-2 text-right font-bold">รวมจำนวนเวชภัณฑ์ทั้งหมด:</td>
                <td className="py-4 px-2 text-right font-black text-xl">
                  {items.reduce((sum, item) => sum + Math.abs(item.qty), 0).toLocaleString()}
                </td>
                <td className="py-4 px-2"></td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-16 text-center text-sm">
            <div>
              <p className="mb-16">ลงชื่อ .......................................................</p>
              <p className="font-bold">({movement.actor?.full_name || '.......................................................'})</p>
              <p className="text-gray-500 mt-1">{isReceive ? 'ผู้ส่งมอบ/ผู้จ่าย' : 'ผู้รับเวชภัณฑ์'}</p>
            </div>
            <div>
              <p className="mb-16">ลงชื่อ .......................................................</p>
              <p className="font-bold">({movement.created_by_user?.full_name || '.......................................................'})</p>
              <p className="text-gray-500 mt-1">ผู้บันทึกระบบคลัง</p>
            </div>
            <div>
              <p className="mb-16">ลงชื่อ .......................................................</p>
              <p className="font-bold">(.......................................................)</p>
              <p className="text-gray-500 mt-1">ผู้ตรวจสอบ</p>
            </div>
          </div>

          <div className="mt-10 text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
            เอกสารนี้พิมพ์จากระบบ RKHSTOCK เมื่อ {new Date().toLocaleString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  );
}
