alter table public.businesses
  add column if not exists account_status text not null default 'active',
  add column if not exists account_suspended_at timestamptz,
  add column if not exists account_deleted_at timestamptz;

alter table public.businesses
  drop constraint if exists businesses_account_status_check;

alter table public.businesses
  add constraint businesses_account_status_check
  check (account_status in ('active', 'suspended', 'deleted'));

create or replace function public.user_in_business(_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.businesses
    where id = _business_id
      and owner_id = auth.uid()
      and account_status <> 'deleted'
  ) or exists (
    select 1
    from public.employees e
    join public.businesses b on b.id = e.business_id
    where e.business_id = _business_id
      and e.user_id = auth.uid()
      and e.active
      and b.account_status = 'active'
  );
$$;

create or replace function public.user_has_business_role(_business_id uuid, _roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.businesses
    where id = _business_id
      and owner_id = auth.uid()
      and account_status <> 'deleted'
  ) or exists (
    select 1
    from public.employees e
    join public.businesses b on b.id = e.business_id
    where e.business_id = _business_id
      and e.user_id = auth.uid()
      and e.active
      and e.role = any(_roles)
      and b.account_status = 'active'
  );
$$;
