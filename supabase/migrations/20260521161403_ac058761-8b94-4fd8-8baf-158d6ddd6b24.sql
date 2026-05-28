-- 1. USERS & PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamp default now()
);
alter table public.profiles enable row level security;

-- Auto create profile on signup (Critical for onboarding)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. BUSINESSES
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  business_name text not null,
  slug text unique not null,
  business_type text not null,
  logo_url text,
  theme_color text default '#6366f1',
  currency text default 'KES',
  tax_rate numeric(5,2) default 16.00, -- Required by POS & Settings
  subscription_plan text default 'trial',
  created_at timestamp default now()
);
alter table public.businesses enable row level security;

-- 3. EMPLOYEES
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'cashier',
  active boolean default true,
  created_at timestamp default now(),
  unique (business_id, user_id)
);
alter table public.employees enable row level security;

-- 4. SECURITY HELPERS (prevent recursion)
create or replace function public.user_owns_business(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid());
$$;

create or replace function public.user_in_business(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses where id = _business_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.employees where business_id = _business_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.user_has_business_role(_business_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = _business_id and owner_id = auth.uid())
      or exists (select 1 from public.employees where business_id = _business_id and user_id = auth.uid() and active and role = any(_roles));
$$;

-- RLS Policies for Profiles, Businesses, Employees
create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);

create policy "businesses_owner_all" on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "businesses_employee_read" on public.businesses
  for select using (public.user_in_business(id));

create policy "employees_owner_manage" on public.employees
  for all using (public.user_owns_business(business_id))
  with check (public.user_owns_business(business_id));
create policy "employees_self_read" on public.employees
  for select using (user_id = auth.uid());

-- 5. CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamp default now()
);
alter table public.categories enable row level security;

create policy "categories_member_read" on public.categories for select using (public.user_in_business(business_id));
create policy "categories_manage" on public.categories for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- 6. PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  barcode text,
  sku text,
  description text,
  price numeric(10,2) not null,
  cost_price numeric(10,2),
  stock_quantity integer default 0,
  low_stock_alert integer default 5,
  image_url text,
  expiry_date date,
  active boolean default true, -- Required by POS
  created_at timestamp default now(),
  unique (business_id, barcode)
);
alter table public.products enable row level security;

create policy "products_member_read" on public.products for select using (public.user_in_business(business_id));
create policy "products_manage" on public.products for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- 7. CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  loyalty_points integer default 0,
  created_at timestamp default now()
);
alter table public.customers enable row level security;

create policy "customers_member_all" on public.customers for all
  using (public.user_in_business(business_id)) with check (public.user_in_business(business_id));

-- 8. SALES
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  cashier_id uuid references public.profiles(id),
  customer_id uuid references public.customers(id) on delete set null,
  subtotal numeric(10,2) default 0.00,       -- Required by POS
  tax_amount numeric(10,2) default 0.00,     -- Required by POS
  discount_amount numeric(10,2) default 0.00,-- Required by POS
  total_amount numeric(10,2),
  payment_method text,
  status text default 'completed',
  created_at timestamp default now()
);
alter table public.sales enable row level security;

create policy "sales_member_read" on public.sales for select using (public.user_in_business(business_id));
create policy "sales_member_create" on public.sales for insert with check (public.user_in_business(business_id));
create policy "sales_manager_update" on public.sales for update
  using (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- 9. SALE ITEMS
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text, -- Required by POS receipts
  quantity integer,
  unit_price numeric(10,2),
  subtotal numeric(10,2)
);
alter table public.sale_items enable row level security;

create policy "sale_items_member_read" on public.sale_items for select using (
  exists (select 1 from public.sales s where s.id = sale_id and public.user_in_business(s.business_id))
);
create policy "sale_items_member_write" on public.sale_items for insert with check (
  exists (select 1 from public.sales s where s.id = sale_id and public.user_in_business(s.business_id))
);

-- 10. INVENTORY LOGS
create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  change_type text,
  quantity integer,
  notes text,
  created_at timestamp default now()
);
alter table public.inventory_logs enable row level security;

create policy "inv_logs_member_read" on public.inventory_logs for select using (public.user_in_business(business_id));
create policy "inv_logs_member_write" on public.inventory_logs for insert with check (public.user_in_business(business_id));

-- 11. SUPPLIERS
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  supplier_name text,
  phone text,
  email text,
  address text,
  created_at timestamp default now()
);
alter table public.suppliers enable row level security;

create policy "suppliers_manage" on public.suppliers for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- 12. PURCHASE ORDERS
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  total_amount numeric(10,2),
  status text default 'pending',
  created_at timestamp default now()
);
alter table public.purchase_orders enable row level security;

create policy "po_manage" on public.purchase_orders for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- 13. ACTIVITY LOGS
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text,
  created_at timestamp default now()
);
alter table public.activity_logs enable row level security;

create policy "act_logs_member_read" on public.activity_logs for select using (public.user_in_business(business_id));
create policy "act_logs_member_write" on public.activity_logs for insert with check (public.user_in_business(business_id));

-- 14. PERFORMANCE INDEXES
create index idx_products_business on public.products(business_id);
create index idx_sales_business_created on public.sales(business_id, created_at desc);
create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_employees_user on public.employees(user_id);
