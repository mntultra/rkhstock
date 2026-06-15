-- Migration: Rename trade_name to abbreviation in products table
BEGIN;

ALTER TABLE public.products 
RENAME COLUMN trade_name TO abbreviation;

COMMIT;
