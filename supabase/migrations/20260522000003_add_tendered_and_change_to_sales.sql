-- Add amount_tendered and change_due columns to public.sales table
alter table public.sales add column if not exists amount_tendered numeric(10,2);
alter table public.sales add column if not exists change_due numeric(10,2);
