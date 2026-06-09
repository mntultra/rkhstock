-- สคริปต์อัตโนมัติสำหรับค้นหาและแก้ไข Foreign Key Constraint ทั้งหมดที่ผูกกับ users
-- เพื่อให้สามารถลบ User ใน Auth ได้

DO $$ 
DECLARE
    rec RECORD;
    drop_sql TEXT;
    add_sql TEXT;
BEGIN
    -- 1. จัดการตาราง public.users ที่ชี้ไป auth.users (ให้ลบตาม CASCADE)
    FOR rec IN 
        SELECT con.conname, 
               att.attname as colname
        FROM pg_constraint con
        JOIN pg_class cl ON con.conrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE ns.nspname = 'public' 
          AND cl.relname = 'users' 
          AND con.contype = 'f' 
          AND con.confrelid = 'auth.users'::regclass
    LOOP
        drop_sql := 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(rec.conname) || ';';
        add_sql := 'ALTER TABLE public.users ADD CONSTRAINT ' || quote_ident(rec.conname) || 
                   ' FOREIGN KEY (' || quote_ident(rec.colname) || ') REFERENCES auth.users(id) ON DELETE CASCADE;';
        EXECUTE drop_sql;
        EXECUTE add_sql;
        RAISE NOTICE 'Updated FK % on public.users', rec.conname;
    END LOOP;

    -- 2. จัดการตารางอื่นๆ ทั้งหมดใน public ที่ชี้มาที่ public.users (ให้ตั้งค่าเป็น SET NULL หรือ CASCADE)
    FOR rec IN 
        SELECT con.conname, 
               cl.relname as tablename,
               att.attname as colname
        FROM pg_constraint con
        JOIN pg_class cl ON con.conrelid = cl.oid
        JOIN pg_namespace ns ON cl.relnamespace = ns.oid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE ns.nspname = 'public' 
          AND con.contype = 'f' 
          AND con.confrelid = 'public.users'::regclass
    LOOP
        drop_sql := 'ALTER TABLE public.' || quote_ident(rec.tablename) || ' DROP CONSTRAINT ' || quote_ident(rec.conname) || ';';
        
        -- ถ้าเป็น default_officers ให้ CASCADE ทิ้งไปเลย ถ้าเป็นตารางใบเบิก/คลัง ให้ SET NULL
        IF rec.tablename = 'default_officers' THEN
            add_sql := 'ALTER TABLE public.' || quote_ident(rec.tablename) || 
                       ' ADD CONSTRAINT ' || quote_ident(rec.conname) || 
                       ' FOREIGN KEY (' || quote_ident(rec.colname) || ') REFERENCES public.users(id) ON DELETE CASCADE;';
        ELSE
            add_sql := 'ALTER TABLE public.' || quote_ident(rec.tablename) || 
                       ' ADD CONSTRAINT ' || quote_ident(rec.conname) || 
                       ' FOREIGN KEY (' || quote_ident(rec.colname) || ') REFERENCES public.users(id) ON DELETE SET NULL;';
        END IF;
        
        EXECUTE drop_sql;
        EXECUTE add_sql;
        RAISE NOTICE 'Updated FK % on public.%', rec.conname, rec.tablename;
    END LOOP;
END $$;
