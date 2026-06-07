create table if not exists public.business_insight_goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  metric text not null default 'sales' check (metric in ('sales', 'profit', 'customers', 'stores')),
  target_amount numeric(14,2) not null default 0,
  period text not null default 'monthly' check (period in ('weekly', 'monthly', 'yearly')),
  created_at timestamp default now()
);

alter table public.business_insight_goals enable row level security;

create policy "business_insight_goals_member_read" on public.business_insight_goals
  for select using (public.user_in_business(business_id));

create policy "business_insight_goals_manager_manage" on public.business_insight_goals
  for all using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create index if not exists idx_business_insight_goals_business
  on public.business_insight_goals(business_id, created_at desc);

create table if not exists public.market_insights (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  category text not null default 'competitor_pricing' check (category in ('competitor_pricing', 'market_trend', 'supplier_price', 'demand_shift')),
  impact_level text not null default 'medium' check (impact_level in ('low', 'medium', 'high')),
  notes text,
  created_at timestamp default now()
);

alter table public.market_insights enable row level security;

create policy "market_insights_member_read" on public.market_insights
  for select using (public.user_in_business(business_id));

create policy "market_insights_manager_manage" on public.market_insights
  for all using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create index if not exists idx_market_insights_business
  on public.market_insights(business_id, created_at desc);
