-- Offline mode settings and sync audit records.

alter table public.business_system_settings
  add column if not exists offline_mode_enabled boolean not null default false,
  add column if not exists offline_auto_sync boolean not null default true,
  add column if not exists offline_cache_products boolean not null default true,
  add column if not exists offline_cache_customers boolean not null default true,
  add column if not exists offline_cache_sales boolean not null default true;

create table if not exists public.offline_sync_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  device_id text,
  status text not null default 'pending' check (status in ('pending', 'syncing', 'completed', 'failed', 'partial')),
  queued_count integer not null default 0 check (queued_count >= 0),
  synced_count integer not null default 0 check (synced_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  payload jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.offline_sync_batches enable row level security;

create index if not exists idx_offline_sync_batches_business_created
  on public.offline_sync_batches (business_id, created_at desc);

drop policy if exists "offline_sync_batches_member_read" on public.offline_sync_batches;
create policy "offline_sync_batches_member_read" on public.offline_sync_batches
  for select using (public.user_in_business(business_id));

drop policy if exists "offline_sync_batches_member_create" on public.offline_sync_batches;
create policy "offline_sync_batches_member_create" on public.offline_sync_batches
  for insert with check (public.user_in_business(business_id));

drop policy if exists "offline_sync_batches_manager_update" on public.offline_sync_batches;
create policy "offline_sync_batches_manager_update" on public.offline_sync_batches
  for update using (public.user_in_business(business_id))
  with check (public.user_in_business(business_id));
