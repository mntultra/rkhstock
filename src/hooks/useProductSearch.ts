import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useProductSearch(debounceMs: number = 300, warehouseId?: string) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // กำหนดเงื่อนไขว่าต้องพิมพ์อย่างน้อย 2 ตัวอักษร
    if (!query || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        // Clean query ป้องกันอักขระที่ทำให้ Supabase .or() พัง (เช่น เครื่องหมาย comma)
        const safeQuery = query.replace(/,/g, '').trim();
        const searchPattern = `%${safeQuery}%`;

        // ค้นหาจาก 4 Field (ตาม Requirement)
        // พร้อมดึง stock_balances มาเพื่อคำนวณยอดคงเหลือ
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            stock_balances ( warehouse_id, current_qty )
          `)
          .or(`generic_name.ilike.${searchPattern},trade_name.ilike.${searchPattern},drug_code.ilike.${searchPattern},gpu_code.ilike.${searchPattern}`)
          .eq('is_active', true)
          .limit(10); // จำกัดผลลัพธ์เพื่อประสิทธิภาพ

        if (error) throw error;

        // คำนวณยอด Stock รวมให้พร้อมใช้งานใน Dropdown
        const processedData = (data || []).map((product: any) => {
          let totalStock = 0;
          if (product.stock_balances && product.stock_balances.length > 0) {
            // ถ้ามีการส่ง warehouseId มาให้กรองเฉพาะคลังนั้น ไม่งั้นรวมทุกคลัง
            const balances = warehouseId 
              ? product.stock_balances.filter((b: any) => b.warehouse_id === warehouseId)
              : product.stock_balances;
              
            totalStock = balances.reduce((sum: number, b: any) => sum + (Number(b.current_qty) || 0), 0);
          }
          
          return {
            ...product,
            total_stock: totalStock
          };
        });

        setResults(processedData);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchProducts, debounceMs);
    return () => clearTimeout(timer);
    
  }, [query, debounceMs, warehouseId]);

  return { query, setQuery, results, isLoading, setResults };
}
