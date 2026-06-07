alter table public.businesses
  add column if not exists trial_started_at timestamptz not null default now(),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists subscription_status text not null default 'trialing';

alter table public.businesses
  alter column subscription_plan set default 'trial';

update public.businesses
set subscription_plan = 'trial'
where subscription_plan is null or subscription_plan = '';

alter table public.businesses
  add constraint businesses_subscription_plan_check
  check (subscription_plan in ('trial', 'business', 'enterprise')) not valid;

alter table public.businesses validate constraint businesses_subscription_plan_check;

alter table public.businesses
  add constraint businesses_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')) not valid;

alter table public.businesses validate constraint businesses_subscription_status_check;

create or replace function public.get_business_package_limits(plan text)
returns table (
  max_businesses integer,
  max_products integer,
  max_staff integer,
  mpesa_enabled boolean,
  analytics_enabled boolean,
  support_level text
)
language sql
stable
as $$
  select
    case when coalesce(plan, 'trial') = 'trial' then 1 else null end as max_businesses,
    case when coalesce(plan, 'trial') = 'trial' then 100 else null end as max_products,
    case
      when coalesce(plan, 'trial') = 'trial' then 1
      when plan = 'business' then 5
      else null
    end as max_staff,
    coalesce(plan, 'trial') in ('business', 'enterprise') as mpesa_enabled,
    coalesce(plan, 'trial') in ('business', 'enterprise') as analytics_enabled,
    case
      when coalesce(plan, 'trial') = 'enterprise' then 'Dedicated CSM'
      when plan = 'business' then 'Priority support'
      else 'Email support'
    end as support_level;
$$;

create or replace function public.enforce_business_package_limit()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  new.subscription_plan := coalesce(new.subscription_plan, 'trial');
  new.subscription_status := coalesce(new.subscription_status, 'trialing');
  new.trial_started_at := coalesce(new.trial_started_at, now());
  new.trial_ends_at := coalesce(new.trial_ends_at, new.trial_started_at + interval '14 days');

  if new.subscription_plan = 'trial' and new.owner_id is not null then
    select count(*)
    into existing_count
    from public.businesses
    where owner_id = new.owner_id;

    if existing_count >= 1 then
      raise exception 'Starter trial allows only 1 business. Upgrade to Business or Enterprise to add more.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_business_package_limit_trigger on public.businesses;
create trigger enforce_business_package_limit_trigger
before insert on public.businesses
for each row execute function public.enforce_business_package_limit();

create or replace function public.enforce_package_downgrade_limit()
returns trigger
language plpgsql
as $$
declare
  product_count integer;
  staff_count integer;
begin
  new.subscription_plan := coalesce(new.subscription_plan, 'trial');

  if new.subscription_plan = 'trial' then
    select count(*) into product_count from public.products where business_id = new.id;
    if product_count > 100 then
      raise exception 'Cannot switch to Starter trial while this business has more than 100 products.';
    end if;
  end if;

  if new.subscription_plan in ('trial', 'business') then
    select count(*)
    into staff_count
    from public.employees
    where business_id = new.id
      and coalesce(role, '') <> 'owner';

    if new.subscription_plan = 'trial' and staff_count > 1 then
      raise exception 'Cannot switch to Starter trial while this business has more than 1 staff member.';
    end if;

    if new.subscription_plan = 'business' and staff_count > 5 then
      raise exception 'Cannot switch to Business while this business has more than 5 staff members.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_package_downgrade_limit_trigger on public.businesses;
create trigger enforce_package_downgrade_limit_trigger
before update of subscription_plan on public.businesses
for each row execute function public.enforce_package_downgrade_limit();

create or replace function public.enforce_product_package_limit()
returns trigger
language plpgsql
as $$
declare
  plan text;
  product_count integer;
begin
  select coalesce(subscription_plan, 'trial')
  into plan
  from public.businesses
  where id = new.business_id;

  if plan = 'trial' then
    select count(*)
    into product_count
    from public.products
    where business_id = new.business_id;

    if product_count >= 100 then
      raise exception 'Starter trial allows up to 100 products. Upgrade to Business for unlimited products.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_package_limit_trigger on public.products;
create trigger enforce_product_package_limit_trigger
before insert on public.products
for each row execute function public.enforce_product_package_limit();

create or replace function public.enforce_staff_package_limit()
returns trigger
language plpgsql
as $$
declare
  plan text;
  staff_count integer;
  staff_limit integer;
begin
  if coalesce(new.role, '') = 'owner' then
    return new;
  end if;

  select coalesce(subscription_plan, 'trial')
  into plan
  from public.businesses
  where id = new.business_id;

  staff_limit := case
    when plan = 'trial' then 1
    when plan = 'business' then 5
    else null
  end;

  if staff_limit is not null then
    select count(*)
    into staff_count
    from public.employees
    where business_id = new.business_id
      and coalesce(role, '') <> 'owner'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if staff_count >= staff_limit then
      raise exception '% package allows up to % staff. Upgrade to add more.', initcap(plan), staff_limit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_staff_package_limit_trigger on public.employees;
create trigger enforce_staff_package_limit_trigger
before insert or update of role, business_id on public.employees
for each row execute function public.enforce_staff_package_limit();
