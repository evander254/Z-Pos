alter table public.purchase_orders
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists idx_purchase_orders_store on public.purchase_orders(store_id);
