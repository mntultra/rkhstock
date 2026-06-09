import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Officer } from '@/types';

/**
 * ดึงรายชื่อเจ้าหน้าที่ (officers) จากตาราง officers
 * @param activeOnly  true = เฉพาะที่ is_active = true
 */
export function useOfficers(activeOnly: boolean = false) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOfficers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('officers')
        .select('id, title, first_name, last_name, full_name, position, email, is_active')
        .order('full_name');
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setOfficers(data || []);
    } catch (err: any) {
      console.error('Error fetching officers:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, [activeOnly]);

  return { officers, isLoading, error, refetch: fetchOfficers };
}
