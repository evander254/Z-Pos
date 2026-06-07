alter table public.purchase_orders
  add column if not exists supplier_name text,
  add column if not exists supplier_contact text,
  add column if not exists notes text,
  add column if not exists items_snapshot jsonb not null default '[]'::jsonb;
