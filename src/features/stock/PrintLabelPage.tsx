import { formatDate } from '@/utils/dateUtils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QrCode, Printer, Search, Minus, Plus } from 'lucide-react';
import { ProductSearchResult } from '@/types';

interface LabelItem {
  id: string; // balance id
  product_name: string;
  drug_code: string;
  lot_number: string;
  expiry_date: string;
  qtyToPrint: number;
}

export default function PrintLabelPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  
  const [balances, setBalances] = useState<any[]>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fuzzy Search ยา
  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('id, generic_name, trade_name, drug_code')
        .ilike('generic_name', `%${searchQuery}%`)
        .eq('is_active', true)
        .limit(10);
      setSearchResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProduct = async (product: ProductSearchResult) => {
    setSelectedProduct(product);
    setSearchQuery(product.generic_name);
    setSearchResults([]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('stock_balances')
        .select('id, lots!inner(lot_number, expiry_date), current_qty')
        .eq('product_id', product.id)
        .gt('current_qty', 0)
        .order('expiry_date', { ascending: true, referencedTable: 'lots' });
        
      if (error) throw error;
      setBalances((data || []).map((b: any) => ({
        id: b.id,
        current_qty: b.current_qty,
        lot_number: b.lots?.lot_number,
        expiry_date: b.lots?.expiry_date
      })));
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addLabel = (balance: any) => {
    if (!selectedProduct) return;
    const existing = labels.find(l => l.id === balance.id);
    if (existing) {
      setLabels(labels.map(l => l.id === balance.id ? { ...l, qtyToPrint: l.qtyToPrint + 1 } : l));
    } else {
      setLabels([...labels, {
        id: balance.id,
        product_name: selectedProduct.generic_name,
        drug_code: selectedProduct.drug_code || '',
        lot_number: balance.lot_number,
        expiry_date: balance.expiry_date,
        qtyToPrint: 1
      }]);
    }
  };

  const updateLabelQty = (id: string, delta: number) => {
    setLabels(labels.map(l => {
      if (l.id === id) {
        const newQty = Math.max(0, l.qtyToPrint + delta);
        return { ...l, qtyToPrint: newQty };
      }
      return l;
    }).filter(l => l.qtyToPrint > 0));
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate an array of all individual labels to print based on qtyToPrint
  const printItems = labels.flatMap(label => Array(label.qtyToPrint).fill(label));

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in-up font-sans select-none">
      
      {/* UI Settings Area (Hidden on Print) */}
      <div className="print:hidden space-y-6">
        <div className="glass p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
              <QrCode size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">พิมพ์สติ๊กเกอร์ (Barcode/QR)</h1>
              <p className="text-gray-500 font-medium">สร้าง Label รหัสเวชภัณฑ์และ Lot สำหรับแปะเวชภัณฑ์ที่ไม่มีบาร์โค้ด</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Select Product & Lot */}
          <div className="glass p-6 rounded-3xl space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-purple-700 font-black border-b border-purple-100 pb-2">1. ค้นหาและเลือกยา</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาชื่อเวชภัณฑ์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-purple-100 outline-none"
              />
              {searchResults.length > 0 && !selectedProduct && (
                <ul className="absolute z-10 w-full bg-white border border-gray-100 mt-1 shadow-lg max-h-60 overflow-auto rounded-xl">
                  {searchResults.map(p => (
                    <li 
                      key={p.id} 
                      onClick={() => handleSelectProduct(p)}
                      className="p-3 hover:bg-purple-50 cursor-pointer border-b border-gray-50 font-medium"
                    >
                      {p.generic_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedProduct && (
              <div className="mt-4 border border-purple-100 rounded-xl p-4 bg-purple-50/30">
                <h3 className="font-bold text-gray-800 mb-3">{selectedProduct.generic_name}</h3>
                {isLoading ? (
                  <p className="text-sm text-gray-500">กำลังโหลดล็อตยา...</p>
                ) : balances.length === 0 ? (
                  <p className="text-sm text-red-500 font-bold">ไม่มียาในสต๊อก</p>
                ) : (
                  <ul className="space-y-2">
                    {balances.map(b => (
                      <li key={b.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                        <div>
                          <p className="text-xs font-mono font-bold text-gray-700">Lot: {b.lot_number || '-'}</p>
                          <p className="text-[10px] text-gray-500">Exp: {formatDate(b.expiry_date)}</p>
                        </div>
                        <button 
                          onClick={() => addLabel(b)}
                          className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-bold transition-colors"
                        >
                          + เพิ่มลงรายการพิมพ์
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right: Print List */}
          <div className="glass p-6 rounded-3xl space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-purple-700 font-black border-b border-purple-100 pb-2">2. รายการสติ๊กเกอร์ที่รอพิมพ์</h2>
            
            {labels.length === 0 ? (
              <div className="text-center py-10 text-gray-400 font-medium text-sm border-2 border-dashed border-gray-200 rounded-xl">
                ยังไม่ได้เลือกรายการเวชภัณฑ์
              </div>
            ) : (
              <ul className="space-y-3 max-h-[400px] overflow-auto pr-2">
                {labels.map(l => (
                  <li key={l.id} className="p-3 bg-white border border-gray-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800 truncate max-w-[200px]">{l.product_name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">Lot: {l.lot_number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateLabelQty(l.id, -1)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"><Minus size={14}/></button>
                      <span className="font-extrabold w-6 text-center">{l.qtyToPrint}</span>
                      <button onClick={() => updateLabelQty(l.id, 1)} className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"><Plus size={14}/></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button 
              onClick={handlePrint}
              disabled={labels.length === 0}
              className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={20} /> สั่งพิมพ์ {printItems.length} ดวง
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              * แนะนำให้ตั้งค่าหน้ากระดาษ (Paper Size) ในเครื่องพิมพ์ให้ตรงกับสติ๊กเกอร์
            </p>
          </div>
        </div>
      </div>

      {/* ================= PRINTABLE AREA ================= */}
      {/* 
        We use print:block hidden. We layout the labels in a flexible wrap or grid.
        Assuming standard label printer rolls (e.g. 50x30mm). We can render each label as a fixed box.
      */}
      <div className="hidden print:flex flex-wrap gap-2 justify-start items-start bg-white">
        {printItems.map((item, index) => {
          // QR Data = productCode|Lot
          const qrData = `${item.drug_code || item.product_name}|${item.lot_number}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}&margin=0`;

          return (
            <div 
              key={index} 
              // Set strict physical dimensions for label. 
              // 50mm x 30mm is common for pharmacy. We'll use approx pixels.
              style={{ width: '50mm', height: '30mm', pageBreakInside: 'avoid' }}
              className="border border-black overflow-hidden flex items-center p-1 bg-white text-black box-border"
            >
              {/* Left: QR Code */}
              <div className="shrink-0 flex items-center justify-center">
                <img src={qrUrl} alt="QR" className="w-[20mm] h-[20mm]" />
              </div>
              
              {/* Right: Text Details */}
              <div className="flex-1 ml-1 flex flex-col justify-center overflow-hidden">
                <p className="text-[9px] font-black leading-tight uppercase truncate" style={{ letterSpacing: '-0.5px' }}>
                  {item.product_name}
                </p>
                {item.drug_code && (
                  <p className="text-[7px] font-bold text-gray-700 mt-[1px]">
                    {item.drug_code}
                  </p>
                )}
                <div className="mt-1">
                  <p className="text-[8px] font-bold font-mono leading-none">
                    L: {item.lot_number}
                  </p>
                  <p className="text-[7px] font-bold font-mono mt-[2px] leading-none">
                    E: {formatDate(item.expiry_date, 'en-GB')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
