import React, { useRef, useEffect, useState } from 'react';
import { useProductSearch } from '@/hooks/useProductSearch'; // ปรับ Path ให้ตรง

type ProductSearchInputProps = {
  onSelect: (product: any) => void;
  warehouseId?: string; // ถ้าต้องการเช็ค Stock แค่คลังใดคลังหนึ่ง
  placeholder?: string;
  className?: string;
  onClickOutside?: () => void;
  autoFocus?: boolean;
};

export default function ProductSearchInput({
  onSelect,
  warehouseId,
  placeholder = 'พิมพ์ชื่อสามัญ (Generic), รหัส, หรือ Abbreviation...',
  className = '',
  onClickOutside,
  autoFocus = false
}: ProductSearchInputProps) {
  const { query, setQuery, results, isLoading, setResults } = useProductSearch(300, warehouseId);
  const [isOpen, setIsOpen] = useState(autoFocus);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onClickOutside) onClickOutside();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Delay focus slightly to ensure DOM is ready and prevent immediate blur from other events
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          setIsOpen(true);
        }
      }, 50);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (product: any) => {
    onSelect(product);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    setResults([]);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* ช่อง Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full py-2.5 pl-11 pr-10 border border-emerald-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-full font-bold text-gray-800 outline-none transition-all placeholder-gray-400/80 text-sm shadow-sm"
        />
        
        {/* Custom magnifying glass SVG matching the image */}
        <svg className="w-[18px] h-[18px] absolute left-4 top-[13px] pointer-events-none" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="5.5" stroke="#3b82f6" strokeWidth="2.5" fill="#dbeafe" />
          <path d="M20 20L15 15.05" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
        </svg>
        
        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="absolute right-4 top-3">
            <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && !isLoading && (
        <ul className="absolute z-50 w-[85vw] sm:w-[500px] left-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-72 overflow-y-auto p-1.5 custom-scrollbar">
          {results.length > 0 ? (
            results.map((product, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={product.id}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(product)}
                  className={`p-3 mx-1 mb-1 last:mb-0 cursor-pointer rounded-xl transition-all flex flex-col gap-1.5
                    ${isSelected ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-gray-50/70 bg-white'}
                  `}
                >
                  <div className="font-extrabold text-gray-900 text-[15px] leading-tight">
                    {product.generic_name}
                    {product.abbreviation && <span className="text-gray-500 font-medium text-xs ml-1.5">({product.abbreviation})</span>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {product.drug_code && (
                      <span className="font-mono font-bold text-gray-500 text-[11px] bg-gray-100 border border-gray-200/50 px-2 py-0.5 rounded">
                        {product.drug_code}
                      </span>
                    )}
                    
                    {product.master_dosage_forms && (
                      <span className="bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded text-[11px] font-bold">
                        {product.master_dosage_forms.abbreviation && product.master_dosage_forms.name_en
                          ? `${product.master_dosage_forms.abbreviation} (${product.master_dosage_forms.name_en})`
                          : product.master_dosage_forms.abbreviation || product.master_dosage_forms.name_en}
                      </span>
                    )}
                    
                    <span className="text-emerald-600 text-[11px] font-bold">
                      บรรจุ {product.pack_size || 1} {product.unit_id?.name || 'ชิ้น'}
                    </span>
                    
                    {product.is_cold_storage && (
                      <span className="bg-cyan-50 text-cyan-600 border border-cyan-200 px-2 py-0.5 rounded text-[10px] font-extrabold">
                        COLD
                      </span>
                    )}
                    {product.is_high_alert && (
                      <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-extrabold">
                        HAD
                      </span>
                    )}
                    {product.is_psycho_narco && (
                      <span className="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-extrabold">
                        PSYCO
                      </span>
                    )}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="p-4 text-center text-gray-500 text-sm">
              ไม่พบรายการเวชภัณฑ์ที่ค้นหา
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
