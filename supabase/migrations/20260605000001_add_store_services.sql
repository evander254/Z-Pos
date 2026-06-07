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

alter table public.store_services enable row level security;

create policy "store_services_member_read" on public.store_services
  for select using (public.user_in_business(business_id));

create policy "store_services_manage" on public.store_services
  for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create index if not exists idx_store_services_business on public.store_services(business_id);
create index if not exists idx_store_services_store on public.store_services(store_id);
create index if not exists idx_store_services_active on public.store_services(active);
