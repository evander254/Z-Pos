-- Add Stores table
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  name text not null,
  location text,
  created_at timestamp default now()
);
alter table public.stores enable row level security;

create policy "stores_member_read" on public.stores for select using (public.user_in_business(business_id));
create policy "stores_manage" on public.stores for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- Update employees table to have store_id
alter table public.employees add column store_id uuid references public.stores(id) on delete set null;

-- Update sales table to have store_id
alter table public.sales add column store_id uuid references public.stores(id) on delete set null;

-- Add Notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  store_id uuid references public.stores(id) on delete set null,
  title text not null,
  message text not null,
  type text not null, -- 'low_stock', 'delivery', 'overdue', 'update'
  is_read boolean default false,
  created_at timestamp default now()
);
alter table public.notifications enable row level security;

create policy "notifications_member_read" on public.notifications for select using (public.user_in_business(business_id));
create policy "notifications_manage" on public.notifications for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

-- Create indexes
create index idx_stores_business on public.stores(business_id);
create index idx_employees_store on public.employees(store_id);
create index idx_sales_store on public.sales(store_id);
create index idx_notifications_business on public.notifications(business_id);
create index idx_notifications_store on public.notifications(store_id);
