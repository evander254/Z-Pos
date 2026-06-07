create table if not exists public.store_inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  store_id uuid references public.stores(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  stock_quantity integer not null default 0,
  low_stock_alert integer,
  updated_at timestamp with time zone default now(),
  unique (store_id, product_id)
);

alter table public.store_inventory enable row level security;

create policy "store_inventory_member_read" on public.store_inventory
  for select using (public.user_in_business(business_id));

create policy "store_inventory_manage" on public.store_inventory
  for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create index if not exists idx_store_inventory_business on public.store_inventory(business_id);
create index if not exists idx_store_inventory_store on public.store_inventory(store_id);
create index if not exists idx_store_inventory_product on public.store_inventory(product_id);
