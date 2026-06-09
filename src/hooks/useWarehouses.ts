import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Warehouse } from '@/types';

export function useWarehouses(activeOnly: boolean = true) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase.from('master_warehouses').select('id, name, is_active').order('name');
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      setWarehouses(data || []);
    } catch (err: any) {
      console.error('Error fetching warehouses:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [activeOnly]);

  return { warehouses, isLoading, error, refetch: fetchWarehouses };
}
