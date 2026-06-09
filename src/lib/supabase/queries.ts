import { supabase } from '@/lib/supabase';

export interface DefaultOfficer {
  id: string;
  user_id: string;
  role_key: string;
}

export interface MasterFiscalYear {
  id: string;
  year_name: string;
  is_active: boolean;
}

export interface OrganizationInfo {
  id: string;
  name?: string;
  requisition_avg_months?: number;
  safety_stock_months?: number;
}

export async function getDefaultOfficers(): Promise<DefaultOfficer[]> {
  const { data, error } = await supabase.from('default_officers').select('*');
  if (error) {
    console.error('Error fetching default officers:', error);
    return [];
  }
  return data || [];
}

export async function getMasterFiscalYears(): Promise<MasterFiscalYear[]> {
  const { data, error } = await supabase
    .from('master_fiscal_years')
    .select('*')
    .order('year_name', { ascending: false });
  if (error) {
    console.error('Error fetching fiscal years:', error);
    return [];
  }
  return data || [];
}

export async function getOrganizationInfo(): Promise<OrganizationInfo | null> {
  const { data, error } = await supabase
    .from('organization_info')
    .select('*')
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('Error fetching org info:', error);
  }
  return data || null;
}
