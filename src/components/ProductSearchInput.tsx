import React, { useRef, useEffect, useState } from 'react';
import { useProductSearch } from '@/hooks/useProductSearch'; // ปรับ Path ให้ตรง

type ProductSearchInputProps = {
  onSelect: (product: any) => void;
  warehouseId?: string; // ถ้าต้องการเช็ค Stock แค่คลังใดคลังหนึ่ง
  placeholder?: string;
  className?: string;
};

export default function ProductSearchInput({
  onSelect,
  warehouseId,
  placeholder = 'ค้นหาชื่อยา, รหัสยา (Trade, Generic, Code)...',
  className = ''
}: ProductSearchInputProps) {
  const { query, setQuery, results, isLoading, setResults } = useProductSearch(300, warehouseId);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ปิด Dropdown เมื่อคลิกพื้นที่อื่น (Click Outside)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard Navigation: เลื่อน ขึ้น/ลง, ยืนยัน (Enter), ปิด (Escape)
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
          // ถ้ากด Enter แต่ยังไม่เลื่อนลูกศร ให้เลือกอันแรกสุดอัตโนมัติ
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
      {/* ช่อง Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
          placeholder={placeholder}
          className="w-full p-3 pl-10 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800"
        />
        <svg 
          className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" 
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        
        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="absolute right-3 top-3.5">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.length >= 2 && !isLoading && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            results.map((product, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={product.id}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(product)}
                  className={`p-3 cursor-pointer border-b last:border-b-0 flex justify-between items-center transition-colors
                    ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm">
                      {product.generic_name} 
                      {product.trade_name && <span className="text-gray-500 font-normal ml-1">({product.trade_name})</span>}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Code: {product.drug_code || '-'} | GPU: {product.gpu_code || '-'}
                    </span>
                  </div>
                  
                  {/* แสดงยอด Stock ปัจจุบัน */}
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      product.total_stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      Stock: {product.total_stock}
                    </span>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="p-4 text-center text-gray-500 text-sm">
              ไม่พบรายการยาที่ค้นหา
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
