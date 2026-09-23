import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect, type ReactNode } from 'react';
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

function getRoleDisplay(role: string | null | undefined): string {
  return role?.toUpperCase() === 'ADMIN' ? 'Admin' : 'User';
}

function formatQuantityWithPack(qty: number, packSize: number | null | undefined, unitName: string): string {
  const formattedQty = Math.abs(qty).toLocaleString();
  const pack = Number(packSize) || 1;
  if (pack > 1) {
    return `${formattedQty} x ${pack} ${unitName}`;
  }
  return `${formattedQty} ${unitName}`;
}

function formatBalanceQuantity(qty: number, packSize: number | null | undefined, unitName: string): string {
  const formattedQty = Math.abs(qty).toLocaleString();
  const pack = Number(packSize) || 1;
  if (pack > 1) {
    return `${formattedQty}x${pack} ${unitName}`;
  }
  return `${formattedQty} ${unitName}`;
}

function InfoRow({ label, children, muted = false }: { label: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-x-3 items-start">
      <span className="font-bold text-gray-600 leading-snug">{label}</span>
      <span className={`font-semibold leading-snug min-w-0 break-words ${muted ? 'text-blue-700' : ''}`}>{children}</span>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-black text-gray-500 border-b border-gray-200 pb-1">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
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
        const officerIds = [
          mov.actor_id,
          mov.receiver,
          mov.approver_main_warehouse,
          mov.issuer_main_warehouse,
          mov.issuer_sub_warehouse,
          mov.voided_by
        ].filter(Boolean);
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
        mov.actor = {
          full_name: mov.movement_type === 'ISSUE'
            ? (officersMap[mov.issuer_sub_warehouse] || '')
            : (officersMap[mov.actor_id] || officersMap[mov.receiver] || (typeof mov.receiver === 'string' ? mov.receiver : '') || '')
        };
        mov.created_by_user = { full_name: '' };
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
            .select('doc_no, doc_date')
            .eq('id', mov.requisition_id)
            .single();
          mov.requisition = { doc_no: reqData?.doc_no || '', doc_date: reqData?.doc_date || '' };
        } else {
          mov.requisition = null;
        }

        // Calculate historical stock balance for ISSUE items in from_warehouse
        if (mov.movement_type === 'ISSUE' && mov.from_warehouse_id && movItems && movItems.length > 0) {
          const warehouseId = mov.from_warehouse_id;
          const productIds = Array.from(new Set(movItems.map((it: any) => it.product_id).filter(Boolean)));

          if (productIds.length > 0) {
            const { data: historyItems, error: historyError } = await supabase
              .from('stock_movement_items')
              .select(`
                id,
                product_id,
                qty,
                created_at,
                movement_id,
                stock_movements!inner(
                  id,
                  movement_type,
                  doc_date,
                  created_at,
                  from_warehouse_id,
                  to_warehouse_id,
                  is_voided
                )
              `)
              .in('product_id', productIds);

            if (!historyError && historyItems) {
              const itemsByProduct: Record<string, any[]> = {};
              for (const hItem of historyItems) {
                const sm = (hItem as any).stock_movements;
                // Exclude voided movements except this movement itself if voided
                if (sm.is_voided && sm.id !== mov.id) continue;

                const isIn = sm.to_warehouse_id === warehouseId;
                const isOut = sm.from_warehouse_id === warehouseId;
                if (!isIn && !isOut) continue;

                if (!itemsByProduct[hItem.product_id]) {
                  itemsByProduct[hItem.product_id] = [];
                }
                itemsByProduct[hItem.product_id].push(hItem);
              }

              const itemBalanceMap: Record<string, number> = {};
              for (const prodId of productIds) {
                const pItems = itemsByProduct[prodId] || [];
                pItems.sort((a: any, b: any) => {
                  const timeA = new Date(a.stock_movements.created_at || a.created_at).getTime();
                  const timeB = new Date(b.stock_movements.created_at || b.created_at).getTime();
                  if (timeA !== timeB) return timeA - timeB;
                  return a.id.localeCompare(b.id);
                });

                let running = 0;
                for (const item of pItems) {
                  const sm = item.stock_movements;
                  let delta = 0;
                  if (sm.movement_type === 'ADJUST') {
                    delta = item.qty || 0;
                  } else if (sm.to_warehouse_id === warehouseId) {
                    delta = Math.abs(item.qty || 0);
                  } else if (sm.from_warehouse_id === warehouseId) {
                    delta = -Math.abs(item.qty || 0);
                  }
                  running += delta;
                  if (item.movement_id === mov.id) {
                    itemBalanceMap[item.id] = running;
                  }
                }
              }

              movItems.forEach((it: any) => {
                it.balanceAfter = itemBalanceMap[it.id] ?? null;
              });
            }
          }
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
  const isIssue = movement.movement_type === 'ISSUE';
  const receiveTotalValue = items.reduce((sum, item) => sum + (Math.abs(item.qty) * (item.unit_price || 0)), 0);
  const issueTotalValue = items.reduce((sum, item) => sum + (Math.abs(item.qty) * (item.unit_price || 0)), 0);
  const docTitle = isReceive ? 'ใบรับเวชภัณฑ์ (Receive Voucher)' :
    isIssue ? 'ใบจ่ายเวชภัณฑ์ (Issue Voucher)' :
      'เอกสารแสดงความเคลื่อนไหวคลัง (Movement Voucher)';
  const docRef = movement.doc_no || `REF-${movement.id.substring(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:bg-white print:py-0 print:m-0 text-black print-document" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800;900&display=swap');
        
        .print-document,
        .print-document *,
        .print-document *:before,
        .print-document *:after {
          font-family: 'Noto Sans Thai', sans-serif !important;
        }

        @media print {
          body, html, #root, .print-document, .print-document * {
            font-family: 'Noto Sans Thai', sans-serif !important;
          }
        }
      `}</style>

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
      <div className="max-w-4xl mx-auto bg-white p-10 sm:p-14 shadow-2xl print:shadow-none print:p-0 relative" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>

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
              <p className="text-xl font-bold">{docRef}</p>
              <p className="text-sm font-medium">วันที่ทำรายการ: {new Date(movement.created_at).toLocaleString('th-TH')}</p>
              {movement.is_voided && (
                <div className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded font-bold text-xs border border-red-300">
                  <Ban size={12} /> ถูกยกเลิกเมื่อ {formatDate(movement.voided_at)}
                </div>
              )}
            </div>
          </div>

          {/* Document Info */}
          {isReceive ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-8 text-sm p-5 border border-gray-200 rounded-xl bg-gray-50/50 print:bg-transparent">
              <InfoSection title="ข้อมูลเอกสาร">
                <InfoRow label="วันที่รับ:">{formatDate(movement.doc_date)}</InfoRow>
                <InfoRow label="หมายเหตุ:">{movement.note || movement.remarks || '-'}</InfoRow>
              </InfoSection>

              <InfoSection title="ข้อมูลคลัง">
                <InfoRow label="รับจาก:">{movement.from_warehouse?.name || movement.source_location || '-'}</InfoRow>
                <InfoRow label="รับเข้าคลัง:">{movement.to_warehouse?.name || '-'}</InfoRow>
              </InfoSection>

              <InfoSection title="ข้อมูลอ้างอิง">
                <InfoRow label="เลขที่เอกสารอ้างอิง (ใบจ่าย/ใบนำส่ง):">
                  {movement.reference_doc_no || '-'}
                </InfoRow>
                <InfoRow label="วันที่เอกสารอ้างอิง:">
                  {movement.reference_doc_date ? formatDate(movement.reference_doc_date) : '-'}
                </InfoRow>
                <InfoRow label="เลขที่ใบขอเบิก (อ้างอิง):" muted>
                  {movement.requisition?.doc_no || '-'}
                </InfoRow>
                <InfoRow label="วันที่ใบขอเบิก (อ้างอิง):">
                  {movement.requisition?.doc_date ? formatDate(movement.requisition.doc_date) : '-'}
                </InfoRow>
              </InfoSection>

              <InfoSection title="ผู้เกี่ยวข้อง">
                <InfoRow label="ผู้รับเวชภัณฑ์:">{movement.actor?.full_name || '-'}</InfoRow>
                <InfoRow label="ผู้บันทึกข้อมูล:">
                  {movement.creatorName ? `${movement.creatorName} (${getRoleDisplay(movement.creatorRole)})` : '-'}
                </InfoRow>
              </InfoSection>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8 text-sm p-5 border border-gray-200 rounded-xl bg-gray-50/50 print:bg-transparent">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">
                    {isIssue ? 'วันที่จ่าย:' : 'วันที่บนเอกสาร:'}
                  </span>
                  <span className="font-semibold">{formatDate(movement.doc_date)}</span>
                </div>

                {isIssue && (
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
                    <span className="w-32 font-bold text-gray-600 shrink-0">เลขที่ใบขอเบิก (อ้างอิง):</span>
                    <span className="font-semibold text-blue-700">{movement.requisition?.doc_no || '-'}</span>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="flex items-start">
                  <span className="w-32 font-bold text-gray-600 shrink-0">
                    {isIssue ? 'ผู้จ่ายเวชภัณฑ์:' : 'ผู้รับ/ผู้เบิก:'}
                  </span>
                  <span className="font-semibold">{movement.actor?.full_name || '-'}</span>
                </div>

                {isIssue && movement.creatorName && (
                  <div className="flex items-start">
                    <span className="w-32 font-bold text-gray-600 shrink-0">ผู้บันทึกข้อมูล:</span>
                    <span className="font-semibold">
                      {movement.creatorName} ({getRoleDisplay(movement.creatorRole)})
                    </span>
                  </div>
                )}

                {(isIssue || movement.note || movement.remarks) && (
                  <div className="flex items-start">
                    <span className="w-32 font-bold text-gray-600 shrink-0">หมายเหตุ:</span>
                    <span className="font-semibold break-words">{movement.note || movement.remarks || '-'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Table */}
          <table className="w-full text-sm border-collapse mb-10">
            <thead>
              <tr className="border-y-2 border-gray-900 bg-gray-50/50 print:bg-transparent">
                <th className="py-3 px-1 text-center w-9 font-bold">ลำดับ</th>
                <th className="py-3 px-1 text-left w-16 font-bold">รหัส</th>
                <th className="py-3 px-2 text-left font-bold min-w-[170px]">รายการเวชภัณฑ์</th>
                <th className="py-3 px-1 text-left w-16 font-bold">รูปแบบ</th>
                <th className="py-3 px-1 text-right w-24 font-bold">จำนวน</th>
                <th className="py-3 px-1 text-left w-20 font-bold">Lot No.</th>
                <th className="py-3 px-1 text-left w-20 font-bold">Exp. Date</th>
                <th className="py-3 px-1 text-right w-20 font-bold">ราคา/หน่วย</th>
                {isIssue && (
                  <th className="py-3 px-1 text-right w-24 font-bold" title="จำนวนยอดคงเหลือจริงหลังจากตัดเบิกรายการนั้นๆ">
                    คงเหลือหลังจ่าย
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const dosageFormDisplay = getDosageFormDisplay(item.product);
                const packSize = Number(item.pack_size) || Number(item.product?.pack_size) || 1;
                const unitName = item.unit_name || item.product?.unit_id?.name || 'ชิ้น';
                const qtyDisplay = formatQuantityWithPack(item.qty, packSize, unitName);
                const balanceDisplay = item.balanceAfter != null
                  ? formatBalanceQuantity(item.balanceAfter, packSize, unitName)
                  : '-';

                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-3 px-1 text-center text-gray-600">{index + 1}</td>
                    <td className="py-3 px-1 text-gray-500 text-xs break-all">{item.product?.drug_code || '-'}</td>
                    <td className="py-3 px-2 font-bold text-gray-900 break-words">{item.product?.generic_name || '-'}</td>
                    <td className="py-3 px-1 text-xs">{dosageFormDisplay}</td>
                    <td className="py-3 px-1 text-right font-black text-sm whitespace-nowrap">{qtyDisplay}</td>
                    <td className="py-3 px-1 text-xs break-all">{item.lots?.lot_number || '-'}</td>
                    <td className="py-3 px-1 text-xs">{item.lots?.expiry_date ? formatDate(item.lots?.expiry_date) : '-'}</td>
                    <td className="py-3 px-1 text-right text-xs">{item.unit_price ? Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                    {isIssue && (
                      <td className="py-3 px-1 text-right font-normal text-xs whitespace-nowrap text-gray-900">
                        {balanceDisplay}
                      </td>
                    )}
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
                  {''}
                </td>
                <td className="py-4 px-1 text-right font-black text-lg">
                  {''}
                </td>
                <td colSpan={2} className="py-4 px-1 text-right font-bold">
                  {isReceive ? 'รวมมูลค่ารับ (บาท):' : isIssue ? 'รวมมูลค่าจ่าย:' : ''}
                </td>
                <td className="py-4 px-1 text-right font-black text-lg">
                  {isReceive
                    ? receiveTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : isIssue
                    ? issueTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : ''
                  }
                </td>
                {isIssue && <td className="py-4 px-1"></td>}
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
