-- เพิ่มคอลัมน์ email ในตาราง users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);
