-- 1. Add expiry_warning_months to organization_info
ALTER TABLE public.organization_info 
ADD COLUMN IF NOT EXISTS expiry_warning_months INTEGER DEFAULT 6;

-- 2. Create manual_expirations table
CREATE TABLE IF NOT EXISTS public.manual_expirations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    lot_number TEXT,
    expiry_date DATE NOT NULL,
    qty INTEGER DEFAULT 0,
    warehouse_id UUID REFERENCES public.master_warehouses(id) ON DELETE SET NULL,
    manufacturer TEXT,
    remark TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- For existing tables, add the new columns if they do not exist
ALTER TABLE public.manual_expirations ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.manual_expirations ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE public.manual_expirations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- Enable RLS
ALTER TABLE public.manual_expirations ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for manual_expirations
-- Allow read for authenticated users
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow read access for authenticated users" 
    ON public.manual_expirations FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow insert for authenticated users
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow insert for authenticated users" 
    ON public.manual_expirations FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow update for authenticated users
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow update for authenticated users" 
    ON public.manual_expirations FOR UPDATE 
    TO authenticated 
    USING (true);

-- Allow delete for authenticated users
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.manual_expirations;
CREATE POLICY "Allow delete for authenticated users" 
    ON public.manual_expirations FOR DELETE 
    TO authenticated 
    USING (true);

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

