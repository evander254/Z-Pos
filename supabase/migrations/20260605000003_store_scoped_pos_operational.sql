-- Store-scoped POS hardening and operational defaults.
-- This migration is safe to run after the existing stores/products/POS migrations.

alter table public.stores add column if not exists active boolean default true;
alter table public.stores add column if not exists inventory_mode text default 'products';
alter table public.products add column if not exists active boolean default true;
alter table public.employees add column if not exists store_id uuid references public.stores(id) on delete set null;
alter table public.sales add column if not exists store_id uuid references public.stores(id) on delete set null;

update public.stores set active = true where active is null;
update public.products set active = true where active is null;
update public.stores set inventory_mode = 'products' where inventory_mode is null;

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

create table if not exists public.store_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  store_id uuid references public.stores(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric not null default 0,
  duration_minutes integer,
  active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.store_inventory enable row level security;
alter table public.store_services enable row level security;

update public.store_services set active = true where active is null;

create index if not exists idx_store_inventory_business on public.store_inventory(business_id);
create index if not exists idx_store_inventory_store on public.store_inventory(store_id);
create index if not exists idx_store_inventory_product on public.store_inventory(product_id);
create index if not exists idx_store_services_business on public.store_services(business_id);
create index if not exists idx_store_services_store on public.store_services(store_id);
create index if not exists idx_store_services_active on public.store_services(active);
create index if not exists idx_employees_store on public.employees(store_id);
create index if not exists idx_sales_store on public.sales(store_id);

create or replace function public.user_assigned_to_store(_business_id uuid, _store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees e
    where e.business_id = _business_id
      and e.user_id = auth.uid()
      and e.active
      and e.store_id = _store_id
  );
$$;

-- Stores: every active business member can open a specific store POS.
drop policy if exists "stores_member_read" on public.stores;
drop policy if exists "stores_pos_read" on public.stores;
create policy "stores_pos_read" on public.stores
  for select using (public.user_in_business(business_id));

-- Store inventory: every active business member can read store POS inventory.
-- The app scopes the POS catalog by the selected store_id.
drop policy if exists "store_inventory_member_read" on public.store_inventory;
drop policy if exists "store_inventory_pos_read" on public.store_inventory;
create policy "store_inventory_pos_read" on public.store_inventory
  for select using (public.user_in_business(business_id));

drop policy if exists "store_inventory_manage" on public.store_inventory;
create policy "store_inventory_manage" on public.store_inventory
  for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- Store services: every active business member can read store POS services.
-- The app scopes the POS catalog by the selected store_id.
drop policy if exists "store_services_member_read" on public.store_services;
drop policy if exists "store_services_pos_read" on public.store_services;
create policy "store_services_pos_read" on public.store_services
  for select using (public.user_in_business(business_id));

drop policy if exists "store_services_manage" on public.store_services;
create policy "store_services_manage" on public.store_services
  for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- Product/category catalog metadata must be readable by anyone who can open a store POS.
-- The app still filters sellable products by store_inventory.store_id.
drop policy if exists "products_member_read" on public.products;
drop policy if exists "products_pos_read" on public.products;
create policy "products_pos_read" on public.products
  for select using (public.user_in_business(business_id));

drop policy if exists "categories_member_read" on public.categories;
drop policy if exists "categories_pos_read" on public.categories;
create policy "categories_pos_read" on public.categories
  for select using (public.user_in_business(business_id));

-- Sales inserts must be tied to a selected store in the same business.
drop policy if exists "sales_member_create" on public.sales;
drop policy if exists "sales_pos_create" on public.sales;
create policy "sales_pos_create" on public.sales
  for insert with check (
    store_id is not null
    and public.user_in_business(business_id)
    and exists (
      select 1 from public.stores s
      where s.id = store_id
        and s.business_id = sales.business_id
        and coalesce(s.active, true)
    )
  );
