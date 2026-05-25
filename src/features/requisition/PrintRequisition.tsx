import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase'; // ปรับ Path ให้ตรงกับโปรเจกต์ของคุณ

// ==========================================
// Types
// ==========================================
type RequisitionItem = {
  id: string;
  product_id: string;
  qty: number;         // จำนวนขอเบิก
  dispensed_qty?: number; // จำนวนจ่ายจริง (ถ้ามี)
  product: {
    drug_code: string;
    generic_name: string;
    unit_id: { name: string };
  };
};

type RequisitionDoc = {
  id: string;
  doc_no: string;
  doc_date: string;
  requester_id: string;
  approver_id: string;
  requester_name?: string;
  approver_name?: string;
  items: RequisitionItem[];
};

// ==========================================
// Main Component
// ==========================================
export default function PrintRequisition() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RequisitionDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ดึงข้อมูลใบเบิกจาก Database
  useEffect(() => {
    const fetchDoc = async () => {
      if (!id) return;
      
      try {
        // ดึงหัวเอกสาร
        const { data: docData, error: docError } = await supabase
          .from('requisitions')
          .select(`
            *,
            requester:users!requester_id(full_name),
            approver:users!approver_id(full_name)
          `)
          .eq('id', id)
          .single();

        if (docError) throw docError;

        // ดึงรายการยา
        const { data: itemsData, error: itemsError } = await supabase
          .from('requisition_items')
          .select(`
            id, qty, product_id,
            product:products (
              drug_code, generic_name,
              unit_id (name)
            )
          `)
          .eq('requisition_id', id);

        if (itemsError) throw itemsError;

        setData({
          ...docData,
          requester_name: docData.requester?.full_name || '.............................................',
          approver_name: docData.approver?.full_name || '.............................................',
          items: itemsData || []
        });
      } catch (error) {
        console.error("Error fetching requisition:", error);
        alert("ไม่พบข้อมูลใบเบิก");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [id]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">กำลังโหลดข้อมูลการพิมพ์...</div>;
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">ข้อมูลผิดพลาด</div>;
  }

  // เงื่อนไข: แสดงคอลัมน์ลำดับเฉพาะเมื่อมี > 1 รายการ
  const showRowNo = data.items.length > 1;

  // Format วันที่แบบไทย
  const formattedDate = new Date(data.doc_date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:py-0 print:bg-white flex justify-center font-sans">
      
      {/* 
        Print CSS Styles
        - ปรับ Size เป็น A4 Portrait
        - ซ่อน Header/Footer ของ Browser Chrome
        - .no-print จะถูกซ่อนเวลาสั่ง Print
      */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm; /* ระยะขอบกระดาษ */
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* กระดาษ A4 Container */}
      <div className="bg-white w-[210mm] min-h-[297mm] shadow-xl print:shadow-none p-[10mm] print:p-0 relative box-border">
        
        {/* Toolbar บนสุด (ไม่พิมพ์) */}
        <div className="no-print flex justify-between items-center mb-6 pb-4 border-b">
          <button 
            onClick={() => navigate(-1)} 
            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded"
          >
            ← กลับ
          </button>
          <button 
            onClick={() => window.print()} 
            className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded shadow font-bold"
          >
            🖨️ สั่งพิมพ์เอกสาร
          </button>
        </div>

        {/* ส่วนหัวเอกสาร */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">โรงพยาบาลร่องคำ</h1>
          <h2 className="text-xl font-bold text-gray-700 mb-4">ใบขอเบิกยาและเวชภัณฑ์ (กลุ่มงานเภสัชกรรม)</h2>
          
          <div className="flex justify-between items-end text-sm text-gray-800 border-b pb-2">
            <div className="text-left">
              <p><strong>หน่วยงานที่ขอเบิก:</strong> ..............................................................</p>
            </div>
            <div className="text-right">
              <p className="mb-1"><strong>เลขที่ใบเบิก:</strong> {data.doc_no || 'RQ-____-____'}</p>
              <p><strong>วันที่:</strong> {formattedDate}</p>
            </div>
          </div>
        </div>

        {/* ตารางรายการยา */}
        <table className="w-full border-collapse border border-black text-[13px] mb-8">
          <thead className="bg-gray-50">
            <tr>
              {showRowNo && <th className="border border-black px-2 py-2 w-12 text-center">ลำดับ</th>}
              <th className="border border-black px-2 py-2 w-24 text-center">รหัสยา</th>
              <th className="border border-black px-2 py-2 text-left">รายการยา (Generic Name)</th>
              <th className="border border-black px-2 py-2 w-20 text-center">หน่วย</th>
              <th className="border border-black px-2 py-2 w-24 text-center">จำนวนขอเบิก</th>
              <th className="border border-black px-2 py-2 w-24 text-center">จำนวนจ่าย</th>
              <th className="border border-black px-2 py-2 w-32 text-center">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={item.id} className="print:break-inside-avoid">
                {showRowNo && (
                  <td className="border border-black px-2 py-1.5 text-center">{index + 1}</td>
                )}
                <td className="border border-black px-2 py-1.5 text-center">{item.product?.drug_code || '-'}</td>
                <td className="border border-black px-2 py-1.5">{item.product?.generic_name}</td>
                {/* ถ้า nested join ลึก ต้อง cast structure หรือ optional chaining ชัวร์ๆ */}
                <td className="border border-black px-2 py-1.5 text-center">{item.product?.unit_id?.name || '-'}</td>
                <td className="border border-black px-2 py-1.5 text-center font-bold">{item.qty}</td>
                <td className="border border-black px-2 py-1.5 text-center"></td>
                <td className="border border-black px-2 py-1.5 text-center"></td>
              </tr>
            ))}
            {/* ทำช่องว่างเผื่อความสวยงามหากรายการน้อย */}
            {data.items.length < 5 && Array.from({ length: 5 - data.items.length }).map((_, i) => (
              <tr key={`empty-${i}`}>
                {showRowNo && <td className="border border-black px-2 py-4"></td>}
                <td className="border border-black px-2 py-4"></td>
                <td className="border border-black px-2 py-4"></td>
                <td className="border border-black px-2 py-4"></td>
                <td className="border border-black px-2 py-4"></td>
                <td className="border border-black px-2 py-4"></td>
                <td className="border border-black px-2 py-4"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ส่วนลายเซ็น (อยู่ด้านล่างสุดของรายการ) */}
        <div className="grid grid-cols-3 gap-8 mt-16 text-sm text-center print:break-inside-avoid">
          {/* ผู้ขอเบิก */}
          <div>
            <div className="mb-4">ลงชื่อ ..............................................................</div>
            <div className="mb-1">( {data.requester_name} )</div>
            <div>ผู้ขอเบิก</div>
          </div>

          {/* ผู้ตรวจรับ */}
          <div>
            <div className="mb-4">ลงชื่อ ..............................................................</div>
            <div className="mb-1">( {data.approver_name} )</div>
            <div>ผู้รับของ / ผู้ตรวจรับ</div>
          </div>

          {/* ผู้อนุมัติ */}
          <div>
            <div className="mb-4">ลงชื่อ ..............................................................</div>
            <div className="mb-1">( .............................................................. )</div>
            <div>ผู้อนุมัติจ่าย / เภสัชกร</div>
          </div>
        </div>

      </div>
    </div>
  );
}
