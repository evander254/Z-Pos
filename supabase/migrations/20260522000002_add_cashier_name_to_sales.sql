-- Add cashier_name column to public.sales table
alter table public.sales add column if not exists cashier_name text;
