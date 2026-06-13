import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function formatThaiLongDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  
  return `${day} ${month} ${year}`;
}
import { supabase } from '@/lib/supabase';

// ==========================================
// Constants
// ==========================================
const PRINT_CONFIG = {
  MAX_UNITS_PER_PAGE: 24,
  MAIN_HEADER_UNITS: 6,
  GROUP_HEADER_UNITS: 2,
  ITEM_UNITS: 1.2,
  SIGNATURE_UNITS: 10,
  FALLBACK_TEXT: '.............................................',
};

// ==========================================
// Types
// ==========================================
type ProductDosageForm = { name_en: string; abbreviation?: string | null };
type ProductUnit = { name: string };
type ProductInfo = {
  drug_code: string;
  generic_name: string;
  trade_name?: string | null;
  is_cold_storage?: boolean;
  is_high_alert?: boolean;
  master_units?: ProductUnit;
  master_dosage_forms?: ProductDosageForm;
};

export type RequisitionItem = {
  id: string;
  product_id: string;
  qty: number;
  dispensed_qty?: number;
  pack_size?: number;
  unit_name?: string;
  remarks?: string;
  substock_qty?: number;
  usage_rate?: number;
  product: ProductInfo;
};

export type GroupedRequisitionItem = RequisitionItem & {
  _groupedDosageForm: string;
};

export type RequisitionDoc = {
  id: string;
  doc_no: string;
  doc_date: string;
  requester_id: string;
  approver_id: string;
  requester_name?: string;
  requester_position?: string;
  approver_name?: string;
  approver_position?: string;
  receiver_name?: string;
  remarks?: string;
  items: GroupedRequisitionItem[];
};

export type PageLayout = {
  pageNumber: number;
  itemsByGroup: Record<string, GroupedRequisitionItem[]>;
  isLastPage: boolean;
  hasMainHeader: boolean;
};

// ==========================================
// Custom Hooks
// ==========================================
function useRequisitionPrintData(id: string | undefined) {
  const [data, setData] = useState<RequisitionDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchDoc = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        // ดึงหัวเอกสาร
        const { data: docData, error: docError } = await supabase
          .from('requisitions')
          .select(`
            *,
            requester:officers!requester_id(full_name, position),
            approver:officers!approver_id(full_name, position)
          `)
          .eq('id', id)
          .single();

        if (docError) throw docError;

        // ดึงรายการเวชภัณฑ์
        const { data: itemsData, error: itemsError } = await supabase
          .from('requisition_items')
          .select(`
            id, qty, product_id, pack_size, unit_name, remarks, substock_qty, usage_rate,
            product:products (
              drug_code, generic_name, trade_name, is_cold_storage, is_high_alert,
              master_units(name:unit_name),
              master_dosage_forms(name_en, abbreviation)
            )
          `)
          .eq('requisition_id', id);

        if (itemsError) throw itemsError;

        // ดึงผู้รับของจาก default_officers
        const { data: defaultOfficersData } = await supabase
          .from('default_officers')
          .select('role_key, officer:officers!user_id(full_name)');

        let receiverName = PRINT_CONFIG.FALLBACK_TEXT;
        if (defaultOfficersData) {
          const receiver = defaultOfficersData.find(d => d.role_key === 'receiver');
          if (receiver && receiver.officer) {
            receiverName = (receiver.officer as any).full_name;
          }
        }

        // Process dosage form grouping
        const processedItems: GroupedRequisitionItem[] = (itemsData || []).map((item: any) => {
          let dosageForm = item.product?.master_dosage_forms?.name_en || 'อื่นๆ (Others)';
          if (item.product?.is_cold_storage && item.product?.is_high_alert) {
            dosageForm += ' + COLD + HAD';
          } else if (item.product?.is_cold_storage) {
            dosageForm += ' + COLD';
          } else if (item.product?.is_high_alert) {
            dosageForm += ' + HAD';
          }
          return { ...item, _groupedDosageForm: dosageForm } as GroupedRequisitionItem;
        });

        // Sort items by dosage form then generic name
        const sortedItems = processedItems.sort((a, b) => {
          const dfA = a._groupedDosageForm;
          const dfB = b._groupedDosageForm;
          if (dfA !== dfB) return dfA.localeCompare(dfB);
          
          const nameA = a.product?.generic_name || '';
          const nameB = b.product?.generic_name || '';
          return nameA.localeCompare(nameB);
        });

        if (isMounted) {
          setData({
            ...docData,
            requester_name: (docData.requester as any)?.full_name || PRINT_CONFIG.FALLBACK_TEXT,
            requester_position: (docData.requester as any)?.position || PRINT_CONFIG.FALLBACK_TEXT,
            approver_name: (docData.approver as any)?.full_name || PRINT_CONFIG.FALLBACK_TEXT,
            approver_position: (docData.approver as any)?.position || PRINT_CONFIG.FALLBACK_TEXT,
            receiver_name: receiverName,
            items: sortedItems
          } as RequisitionDoc);
        }
      } catch (error) {
        console.error("Error fetching requisition:", error);
        alert("ไม่พบข้อมูลใบเบิก");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDoc();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return { data, isLoading };
}

// ==========================================
// Utility functions
// ==========================================
function calculatePrintLayout(items: GroupedRequisitionItem[]): PageLayout[] {
  if (!items || items.length === 0) return [];

  // Group items
  const groupedItems = items.reduce((acc: Record<string, GroupedRequisitionItem[]>, item) => {
    const dosageForm = item._groupedDosageForm;
    if (!acc[dosageForm]) acc[dosageForm] = [];
    acc[dosageForm].push(item);
    return acc;
  }, {});

  const pages: PageLayout[] = [];
  let currentPageItems: Record<string, GroupedRequisitionItem[]> = {};
  let currentUnits = PRINT_CONFIG.MAIN_HEADER_UNITS;
  let pageNum = 1;

  const sortedGroups = Object.keys(groupedItems).sort();

  for (const dosageForm of sortedGroups) {
    const groupItems = groupedItems[dosageForm];

    if (currentUnits + PRINT_CONFIG.GROUP_HEADER_UNITS > PRINT_CONFIG.MAX_UNITS_PER_PAGE) {
      pages.push({ pageNumber: pageNum, itemsByGroup: currentPageItems, isLastPage: false, hasMainHeader: pageNum === 1 });
      pageNum++;
      currentPageItems = {};
      currentUnits = 0;
    }

    currentUnits += PRINT_CONFIG.GROUP_HEADER_UNITS;
    currentPageItems[dosageForm] = [];

    for (const item of groupItems) {
      let itemUnits = PRINT_CONFIG.ITEM_UNITS;
      if ((item.product?.generic_name?.length || 0) > 40) itemUnits += 0.5;
      if ((item.remarks?.length || 0) > 20) itemUnits += 0.5;

      if (currentUnits + itemUnits > PRINT_CONFIG.MAX_UNITS_PER_PAGE) {
        pages.push({ pageNumber: pageNum, itemsByGroup: currentPageItems, isLastPage: false, hasMainHeader: pageNum === 1 });
        pageNum++;
        currentPageItems = {};
        currentPageItems[dosageForm] = [];
        currentUnits = PRINT_CONFIG.GROUP_HEADER_UNITS; // Repeat group header
      }

      currentPageItems[dosageForm].push(item);
      currentUnits += itemUnits;
    }
  }

  // Check if signatures fit
  if (currentUnits + PRINT_CONFIG.SIGNATURE_UNITS > PRINT_CONFIG.MAX_UNITS_PER_PAGE) {
    pages.push({ pageNumber: pageNum, itemsByGroup: currentPageItems, isLastPage: false, hasMainHeader: pageNum === 1 });
    pageNum++;
    currentPageItems = {};
    currentUnits = 0;
  }

  pages.push({ pageNumber: pageNum, itemsByGroup: currentPageItems, isLastPage: true, hasMainHeader: pageNum === 1 });
  
  return pages;
}

// ==========================================
// Main Component
// ==========================================
export default function PrintRequisition() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data, isLoading } = useRequisitionPrintData(id);

  const pages = useMemo(() => {
    if (!data?.items) return [];
    return calculatePrintLayout(data.items);
  }, [data?.items]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">กำลังโหลดข้อมูลการพิมพ์...</div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">ข้อมูลผิดพลาด</div>;
  }

  const formattedDate = formatThaiLongDate(data.doc_date);

  const totalPages = pages.length;
  let globalItemIndex = 1;

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:py-0 print:bg-white print:block flex justify-center thsarabun-font">
      <style>{`
        @font-face {
          font-family: 'THSarabunNew';
          src: url('/fonts/THsarabunNew/THSarabunNew.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family: 'THSarabunNew';
          src: url('/fonts/THsarabunNew/THSarabunNew Bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        @font-face {
          font-family: 'THSarabunNew';
          src: url('/fonts/THsarabunNew/THSarabunNew Italic.ttf') format('truetype');
          font-weight: 400;
          font-style: italic;
        }
        @font-face {
          font-family: 'THSarabunNew';
          src: url('/fonts/THsarabunNew/THSarabunNew BoldItalic.ttf') format('truetype');
          font-weight: 700;
          font-style: italic;
        }

        @page {
          size: A4 portrait;
          margin: 0; 
        }

        body {
          font-family: 'THSarabunNew', sans-serif !important;
        }

        .page-container {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          background: white;
          padding: 20mm 15mm;
          box-sizing: border-box;
          box-shadow: 0px 4px 10px rgba(0,0,0,0.1);
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: white !important;
            width: 210mm !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: 'THSarabunNew', sans-serif !important;
          }
          .page-container {
            margin: 0 !important;
            box-shadow: none;
            padding: 20mm 15mm;
            page-break-after: always;
            box-sizing: border-box;
            height: 297mm;
            width: 210mm !important;
            overflow: hidden;
          }
          .page-container:last-child {
            page-break-after: auto;
          }
          .no-print {
            display: none !important;
          }
        }

        .thsarabun-font, .thsarabun-font * {
          font-family: 'THSarabunNew', sans-serif !important;
        }

        table.sarabun-table th, table.sarabun-table td {
          border: 1px solid black;
          padding: 4px 6px;
        }
      `}</style>

      <div className="flex flex-col items-center print:block">
        {/* Toolbar บนสุด (ไม่พิมพ์) */}
        <div className="no-print w-[210mm] flex justify-between items-center mb-4 mt-8 pb-4 border-b">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            ← กลับ
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded shadow font-bold transition-colors"
          >
            🖨️ สั่งพิมพ์เอกสาร
          </button>
        </div>

        {/* Render each page */}
        {pages.map((page, pIdx) => (
          <div key={pIdx} className="page-container thsarabun-font text-black flex flex-col">
            <div>
              {page.hasMainHeader && (
                <>
                  {/* ส่วนหัวเอกสาร */}
                  <div className="text-center mb-4 leading-relaxed">
                    <h1 className="text-[20pt] font-bold">ใบเบิกวัสดุ (เวชภัณฑ์ยา/เวชภัณฑ์มิใช่ยา)</h1>
                    <h2 className="text-[18pt]">กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร่องคำ อำเภอร่องคำ จังหวัดกาฬสินธุ์</h2>
                    <div className="mt-2 text-[16pt]">{formattedDate}</div>
                  </div>

                  {/* ข้อความเกริ่นนำ */}
                  <div className="mb-4 text-[16pt] leading-tight text-justify" style={{ textIndent: '2.5rem' }}>
                    ด้วยกลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค (คลังเวชภัณฑ์ย่อย) ขอเบิกเวชภัณฑ์ยา/เวชภัณฑ์มิใช่ยา เพื่อใช้ในงานราชการ โรงพยาบาลร่องคำ โดยมอบหมายให้ {data.receiver_name} เป็นผู้รับของ จำนวน {data.items.length} รายการ ดังนี้
                  </div>
                </>
              )}

              {/* ตารางรายการเวชภัณฑ์ */}
              <div className="mb-4">
                {Object.keys(page.itemsByGroup).sort().map((dosageForm) => {
                  const items = page.itemsByGroup[dosageForm];
                  if (items.length === 0) return null;
                  return (
                    <div key={dosageForm} className="mb-2">
                      <div className="font-bold text-[16pt] mb-1">{dosageForm}</div>
                      <table className="w-full border-collapse border border-black text-[15pt] sarabun-table">
                        <thead className="bg-transparent">
                          <tr>
                            <th className="font-normal w-10 text-center">ลำดับ</th>
                            <th className="font-normal text-center">รายการ</th>
                            <th className="font-normal w-20 text-center">หน่วยนับ</th>
                            <th className="font-normal w-16 text-center">อัตราใช้</th>
                            <th className="font-normal w-16 text-center">คงเหลือ</th>
                            <th className="font-normal w-12 text-center">เบิก</th>
                            <th className="font-normal w-12 text-center">อนุมัติ</th>
                            <th className="font-normal w-20 text-center">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => {
                            const currentIndex = globalItemIndex++;
                            const unitDisplay = (item.pack_size && item.pack_size !== 1) ? `${item.pack_size} ${item.product?.master_units?.name || item.unit_name || ''}` : `1 ${item.product?.master_units?.name || item.unit_name || ''}`;
                            
                            return (
                              <tr key={item.id} className="print:break-inside-avoid">
                                <td className="text-center">{currentIndex}</td>
                                <td className="text-left">
                                  {item.product?.generic_name}
                                  {item.product?.trade_name && (
                                    <span> ({item.product.trade_name})</span>
                                  )}
                                </td>
                                <td className="text-center">{unitDisplay}</td>
                                <td className="text-center">{item.usage_rate !== undefined ? item.usage_rate : '-'}</td>
                                <td className="text-center">{item.substock_qty !== undefined ? item.substock_qty : '0'}</td>
                                <td className="text-center">{item.qty}</td>
                                <td className="text-center"></td>
                                <td className="text-left text-[13pt]">{item.remarks || ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ส่วนลงท้ายและลายเซ็น - เฉพาะหน้าสุดท้าย */}
            <div>
              {page.isLastPage && (
                <div className="text-[16pt] leading-tight print:break-inside-avoid mt-8">
                  <div className="mb-8">เรียน หัวหน้าเจ้าหน้าที่พัสดุ เพื่อโปรดทราบและพิจารณา</div>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    {/* ซ้าย: ผู้อนุมัติ/หัวหน้าหน่วยพัสดุ */}
                    <div>
                      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] w-full items-center whitespace-nowrap">
                        <div className="text-right pr-1">(ลงชื่อ)</div>
                        <div className="text-center">................................................</div>
                        <div className="text-left pl-1">(ผู้อนุมัติ/หัวหน้าหน่วยพัสดุ)</div>
                      </div>
                      <div className="mb-2">( {data.approver_name} )</div>
                      <div className="mb-2">ตำแหน่ง {data.approver_position}</div>
                      <div className="flex items-center justify-center mt-2 whitespace-nowrap">
                        <span>วันที่</span>
                        <span className="mx-1">......</span>
                        <span>เดือน</span>
                        <span className="mx-1">........................</span>
                        <span>พ.ศ.</span>
                        <span className="mx-1">..........</span>
                      </div>
                    </div>

                    {/* ขวา: ผู้เบิก */}
                    <div>
                      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] w-full items-center whitespace-nowrap">
                        <div className="text-right pr-1">(ลงชื่อ)</div>
                        <div className="text-center">................................................</div>
                        <div className="text-left pl-1">(ผู้เบิก)</div>
                      </div>
                      <div className="mb-2">( {data.requester_name} )</div>
                      <div className="mb-2">ตำแหน่ง {data.requester_position}</div>
                      <div className="flex items-center justify-center mt-2 whitespace-nowrap">
                        <span>วันที่</span>
                        <span className="mx-1">......</span>
                        <span>เดือน</span>
                        <span className="mx-1">........................</span>
                        <span>พ.ศ.</span>
                        <span className="mx-1">..........</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}


            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
