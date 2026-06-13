import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Printer, ArrowLeft, Ban } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function getDosageFormDisplay(product: any): string {
  if (!product) return '-';
  const df = product.master_dosage_forms?.abbreviation || product.master_dosage_forms?.name_en || '';
  const tags: string[] = [];
  if (product.is_cold_storage) tags.push('COLD');
  if (product.is_high_alert) tags.push('HAD');

  if (tags.length > 0) {
    return `${df} (${tags.join(', ')})`.trim();
  }
  return df || '-';
}

function calculateThaiFiscalYear(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  const calendarYear = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  
  const beYear = calendarYear + 543;
  const fiscalYear = month >= 10 ? beYear + 1 : beYear;
  
  return fiscalYear.toString();
}

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
            product:products(
              drug_code, 
              generic_name, 
              is_cold_storage, 
              is_high_alert, 
              unit_id:unit_id(name:unit_name), 
              master_dosage_forms(name_en, abbreviation)
            ),
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

        // Fetch creator user details from 'users' table and join with 'officers'
        let creatorName = '';
        let creatorRole = '';
        if (mov.created_by) {
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, role, officer:officers(full_name, position)')
            .eq('id', mov.created_by)
            .maybeSingle();

          if (userData) {
            const officerObj = Array.isArray(userData.officer) ? userData.officer[0] : userData.officer;
            const officerName = officerObj?.full_name;
            creatorName = officerName || userData.full_name || '';
            creatorRole = userData.role || '';
          }
        }
        mov.creatorName = creatorName;
        mov.creatorRole = creatorRole;

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

        // Sort items by: dosage form > HAD / COLD > name
        const sortedItems = (movItems || []).sort((a: any, b: any) => {
          const dfA = a.product?.master_dosage_forms?.abbreviation || a.product?.master_dosage_forms?.name_en || '';
          const dfB = b.product?.master_dosage_forms?.abbreviation || b.product?.master_dosage_forms?.name_en || '';
          const dfCompare = dfA.localeCompare(dfB);
          if (dfCompare !== 0) return dfCompare;

          const scoreA = (a.product?.is_cold_storage ? 1 : 0) + (a.product?.is_high_alert ? 2 : 0);
          const scoreB = (b.product?.is_cold_storage ? 1 : 0) + (b.product?.is_high_alert ? 2 : 0);
          if (scoreA !== scoreB) return scoreA - scoreB;

          const nameA = a.product?.generic_name || '';
          const nameB = b.product?.generic_name || '';
          return nameA.localeCompare(nameB);
        });

        setMovement(mov);
        setItems(sortedItems);
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
  const docTitle = isReceive ? 'ใบรับเวชภัณฑ์ (Receive Voucher)' :
    isDispense ? 'ใบจ่ายเวชภัณฑ์ (Issue Voucher)' :
      'เอกสารแสดงความเคลื่อนไหวคลัง (Movement Voucher)';
  const docRef = movement.doc_no || `REF-${movement.id.substring(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:bg-white print:py-0 print:m-0 text-black" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>

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
              <p className="text-gray-600 font-medium">กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร่องคำ</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xl font-bold font-sans">{docRef}</p>
              {!isDispense && (
                <p className="text-sm font-medium">วันที่ทำรายการ: {new Date(movement.created_at).toLocaleString('th-TH')}</p>
              )}
              {movement.is_voided && (
                <div className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded font-bold text-xs border border-red-300">
                  <Ban size={12} /> ถูกยกเลิกเมื่อ {formatDate(movement.voided_at)}
                </div>
              )}
            </div>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8 text-sm p-5 border border-gray-200 rounded-xl bg-gray-50/50 print:bg-transparent">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="flex items-start">
                <span className="w-32 font-bold text-gray-600 shrink-0">
                  {isDispense ? 'วันที่จ่าย:' : 'วันที่บนเอกสาร:'}
                </span>
                <span className="font-semibold">{formatDate(movement.doc_date)}</span>
              </div>

              {isReceive && (
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">คลังที่รับเข้า:</span>
                  <span className="font-semibold">{movement.to_warehouse?.name || '-'}</span>
                </div>
              )}

              {isDispense && (
                <>
                  <div className="flex items-start">
                    <span className="w-32 font-bold text-gray-600 shrink-0">คลังต้นทาง:</span>
                    <span className="font-semibold text-gray-900">{movement.from_warehouse?.name || '-'}</span>
                  </div>
                  {movement.to_warehouse?.name && (
                    <div className="flex items-start">
                      <span className="w-32 font-bold text-gray-600 shrink-0">จ่ายไปที่:</span>
                      <span className="font-semibold text-gray-900">{movement.to_warehouse.name}</span>
                    </div>
                  )}
                </>
              )}

              {movement.requisition_id && (
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">จากใบขอเบิกเลขที่:</span>
                  <span className="font-semibold text-blue-700">{movement.requisition?.doc_no || '-'}</span>
                </div>
              )}

              {!isDispense && (
                <>
                  <div className="flex items-start">
                    <span className="w-32 font-bold text-gray-600 shrink-0">เอกสารอ้างอิง:</span>
                    <span className="font-semibold">{movement.reference_doc_no || '-'}</span>
                  </div>
                  {movement.reference_doc_date && (
                    <div className="flex items-start">
                      <span className="w-32 font-bold text-gray-600 shrink-0">วันที่เอกสารอ้างอิง:</span>
                      <span className="font-semibold">{formatDate(movement.reference_doc_date)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="flex items-start">
                <span className="w-32 font-bold text-gray-600 shrink-0">ปีงบประมาณ:</span>
                <span className="font-semibold">{movement.fiscal_year || calculateThaiFiscalYear(movement.doc_date)}</span>
              </div>

              {!isDispense && (
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">แหล่งที่มา/ไป:</span>
                  <span className="font-semibold">{movement.source_location || '-'}</span>
                </div>
              )}

              <div className="flex items-start">
                <span className="w-32 font-bold text-gray-600 shrink-0">
                  {isReceive ? 'ผู้รับเวชภัณฑ์:' : isDispense ? 'ผู้จ่ายเวชภัณฑ์:' : 'ผู้รับ/ผู้เบิก:'}
                </span>
                <span className="font-semibold">{movement.actor?.full_name || '-'}</span>
              </div>

              {isDispense && movement.creatorName && (
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">ผู้บันทึกข้อมูล:</span>
                  <span className="font-semibold">
                    {movement.creatorName} ({movement.creatorRole === 'ADMIN' ? 'Admin' : 'User'})
                  </span>
                </div>
              )}

              {(movement.note || movement.remarks) && (
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">หมายเหตุ:</span>
                  <span className="font-semibold break-words">{movement.note || movement.remarks}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm border-collapse mb-10">
            <thead>
              <tr className="border-y-2 border-gray-900 bg-gray-50/50 print:bg-transparent">
                <th className="py-3 px-1 text-center w-10 font-bold">ลำดับ</th>
                <th className="py-3 px-1 text-left w-20 font-bold">รหัส</th>
                <th className="py-3 px-2 text-left w-72 font-bold">รายการเวชภัณฑ์</th>
                <th className="py-3 px-1 text-left w-20 font-bold">รูปแบบ</th>
                <th className="py-3 px-1 text-right w-28 font-bold">จำนวน</th>
                <th className="py-3 px-1 text-left w-24 font-bold">Lot No.</th>
                <th className="py-3 px-1 text-left w-24 font-bold">Exp. Date</th>
                <th className="py-3 px-1 text-right w-20 font-bold">ราคา/หน่วย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const dosageFormDisplay = getDosageFormDisplay(item.product);
                const packSize = item.pack_size || 1;
                const unitName = item.unit_name || item.product?.unit_id?.name || 'ชิ้น';
                const qtyDisplay = `${Math.abs(item.qty).toLocaleString()} x ${packSize} ${unitName}`;

                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-3 px-1 text-center text-gray-600">{index + 1}</td>
                    <td className="py-3 px-1 font-sans text-gray-500 text-xs break-all">{item.product?.drug_code || '-'}</td>
                    <td className="py-3 px-2 font-bold text-gray-900 break-words">{item.product?.generic_name || '-'}</td>
                    <td className="py-3 px-1 text-xs">{dosageFormDisplay}</td>
                    <td className="py-3 px-1 text-right font-black text-sm whitespace-nowrap">{qtyDisplay}</td>
                    <td className="py-3 px-1 font-sans text-xs break-all">{item.lots?.lot_number || '-'}</td>
                    <td className="py-3 px-1 text-xs">{item.lots?.expiry_date ? formatDate(item.lots?.expiry_date) : '-'}</td>
                    <td className="py-3 px-1 text-right text-xs">{item.unit_price ? Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900 font-bold">
                <td colSpan={3} className="py-4 px-1 text-left">
                  รวมทั้งหมด {items.length} รายการ
                </td>
                <td className="py-4 px-1 text-right">
                  {isReceive ? 'รวมจำนวนรับ:' : ''}
                </td>
                <td className="py-4 px-1 text-right font-black text-lg">
                  {isReceive ? items.reduce((sum, item) => sum + Math.abs(item.qty), 0).toLocaleString() : ''}
                </td>
                <td colSpan={2} className="py-4 px-1 text-right font-bold">
                  {isDispense ? 'รวมมูลค่าจ่าย:' : ''}
                </td>
                <td className="py-4 px-1 text-right font-black text-lg">
                  {isDispense 
                    ? items.reduce((sum, item) => sum + (Math.abs(item.qty) * (item.unit_price || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : ''
                  }
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-10 text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
            เอกสารนี้พิมพ์จากระบบ RKHSTOCK เมื่อ {new Date().toLocaleString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  );
}
