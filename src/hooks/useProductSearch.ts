import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useProductSearch(debounceMs: number = 300, warehouseId?: string) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        let queryBuilder = supabase
          .from('products')
          .select(`
            *,
            unit_id:unit_id(name:unit_name),
            master_dosage_forms(name_en, abbreviation),
            stock_balances ( warehouse_id, current_qty )
          `)
          .eq('is_active', true);

        if (query && query.trim().length >= 2) {
          const safeQuery = query.replace(/,/g, '').trim();
          const searchPattern = `%${safeQuery}%`;
          queryBuilder = queryBuilder.or(`generic_name.ilike.${searchPattern},abbreviation.ilike.${searchPattern},drug_code.ilike.${searchPattern},gpu_code.ilike.${searchPattern}`);
        } else {
          // If query is empty or too short, order alphabetically by generic_name
          queryBuilder = queryBuilder.order('generic_name', { ascending: true });
        }

        const { data, error } = await queryBuilder.limit(10); // จำกัดผลลัพธ์เพื่อประสิทธิภาพ

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

    if (query === '') {
      fetchProducts();
    } else {
      const timer = setTimeout(fetchProducts, debounceMs);
      return () => clearTimeout(timer);
    }
  }, [query, debounceMs, warehouseId]);

  return { query, setQuery, results, isLoading, setResults };
}
