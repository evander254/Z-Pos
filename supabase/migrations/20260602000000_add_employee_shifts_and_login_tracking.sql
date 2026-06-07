-- Employee shift scheduling, login tracking, and cashier performance timing.
-- Owners/admins/managers can assign shifts. Cashier login can be checked through RPC before authentication completes.

alter table public.sales add column if not exists sale_started_at timestamptz;
alter table public.sales add column if not exists sale_completed_at timestamptz;
alter table public.sales add column if not exists checkout_duration_seconds integer;

create index if not exists idx_sales_cashier_created_at on public.sales(cashier_id, created_at);
create index if not exists idx_sales_checkout_duration on public.sales(checkout_duration_seconds);

create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 Sunday, 6 Saturday
  starts_at time not null,
  ends_at time not null,
  grace_minutes integer not null default 10 check (grace_minutes between 0 and 120),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_shifts_employee_day on public.employee_shifts(employee_id, day_of_week, active);
create index if not exists idx_employee_shifts_business on public.employee_shifts(business_id);

create table if not exists public.employee_login_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid,
  shift_id uuid references public.employee_shifts(id) on delete set null,
  login_at timestamptz not null default now(),
  logout_at timestamptz,
  login_method text not null default 'password',
  device_label text,
  ip_address inet,
  was_within_shift boolean not null default false,
  denied boolean not null default false,
  denial_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_login_sessions_employee on public.employee_login_sessions(employee_id, login_at desc);
create index if not exists idx_employee_login_sessions_business on public.employee_login_sessions(business_id, login_at desc);
create index if not exists idx_employee_login_sessions_shift on public.employee_login_sessions(shift_id);

alter table public.employee_shifts enable row level security;
alter table public.employee_login_sessions enable row level security;

drop policy if exists "employee_shifts_member_read" on public.employee_shifts;
create policy "employee_shifts_member_read" on public.employee_shifts for select
  using (public.user_in_business(business_id));

drop policy if exists "employee_shifts_manage" on public.employee_shifts;
create policy "employee_shifts_manage" on public.employee_shifts for all
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

drop policy if exists "employee_login_sessions_member_read" on public.employee_login_sessions;
create policy "employee_login_sessions_member_read" on public.employee_login_sessions for select
  using (public.user_in_business(business_id));

drop policy if exists "employee_login_sessions_insert_member" on public.employee_login_sessions;
create policy "employee_login_sessions_insert_member" on public.employee_login_sessions for insert
  with check (public.user_in_business(business_id));

drop policy if exists "employee_login_sessions_update_manage" on public.employee_login_sessions;
create policy "employee_login_sessions_update_manage" on public.employee_login_sessions for update
  using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employee_shifts_updated_at on public.employee_shifts;
create trigger trg_employee_shifts_updated_at
before update on public.employee_shifts
for each row execute function public.touch_updated_at();

create or replace function public.find_current_employee_shift(
  p_employee_id uuid,
  p_business_id uuid,
  p_at timestamptz default now()
)
returns table(shift_id uuid, within_shift boolean)
language sql
security definer
set search_path = public
as $$
  with current_context as (
    select
      extract(dow from p_at)::smallint as dow,
      (p_at at time zone current_setting('timezone'))::time as local_time
  )
  select s.id,
    case
      when s.ends_at >= s.starts_at then
        c.local_time between (s.starts_at - make_interval(mins => s.grace_minutes)) and s.ends_at
      else
        c.local_time >= (s.starts_at - make_interval(mins => s.grace_minutes)) or c.local_time <= s.ends_at
    end as within_shift
  from public.employee_shifts s
  cross join current_context c
  where s.employee_id = p_employee_id
    and s.business_id = p_business_id
    and s.active = true
    and s.day_of_week = c.dow
  order by s.starts_at
  limit 1;
$$;

create or replace function public.can_employee_login_now(
  p_employee_id uuid,
  p_business_id uuid
)
returns table(allowed boolean, reason text, shift_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_shift uuid;
  is_within boolean;
  active_shift_count integer;
begin
  select count(*) into active_shift_count
  from public.employee_shifts
  where employee_id = p_employee_id
    and business_id = p_business_id
    and active = true;

  -- If no shift has been assigned yet, allow login so existing businesses are not locked out.
  if active_shift_count = 0 then
    allowed := true;
    reason := 'No active shift assigned; login allowed.';
    shift_id := null;
    return next;
    return;
  end if;

  select f.shift_id, f.within_shift into matched_shift, is_within
  from public.find_current_employee_shift(p_employee_id, p_business_id) f;

  if coalesce(is_within, false) then
    allowed := true;
    reason := 'Login allowed during assigned shift.';
    shift_id := matched_shift;
  else
    allowed := false;
    reason := 'Login denied. You are outside your assigned working shift.';
    shift_id := matched_shift;
  end if;
  return next;
end;
$$;

create or replace function public.record_employee_login_session(
  p_employee_id uuid,
  p_business_id uuid,
  p_user_id uuid default null,
  p_login_method text default 'password',
  p_device_label text default null,
  p_ip_address inet default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  session_id uuid;
  access record;
begin
  select * into access from public.can_employee_login_now(p_employee_id, p_business_id) limit 1;

  insert into public.employee_login_sessions (
    business_id,
    employee_id,
    user_id,
    shift_id,
    login_method,
    device_label,
    ip_address,
    was_within_shift,
    denied,
    denial_reason
  ) values (
    p_business_id,
    p_employee_id,
    p_user_id,
    access.shift_id,
    p_login_method,
    p_device_label,
    p_ip_address,
    coalesce(access.allowed, true),
    not coalesce(access.allowed, true),
    case when coalesce(access.allowed, true) then null else access.reason end
  ) returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.end_employee_login_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employee_login_sessions
  set logout_at = coalesce(logout_at, now())
  where id = p_session_id;
$$;

create or replace view public.cashier_performance_summary as
select
  s.business_id,
  s.store_id,
  s.cashier_id,
  s.cashier_name,
  date_trunc('day', s.created_at) as sales_day,
  count(*) as sale_count,
  sum(s.total_amount) as total_sales,
  avg(s.total_amount) as average_sale_value,
  avg(s.checkout_duration_seconds) as average_checkout_seconds,
  percentile_cont(0.5) within group (order by s.checkout_duration_seconds) as median_checkout_seconds,
  max(s.total_amount) as largest_sale
from public.sales s
group by s.business_id, s.store_id, s.cashier_id, s.cashier_name, date_trunc('day', s.created_at);

grant execute on function public.can_employee_login_now(uuid, uuid) to anon, authenticated;
grant execute on function public.record_employee_login_session(uuid, uuid, uuid, text, text, inet) to anon, authenticated;
grant execute on function public.end_employee_login_session(uuid) to anon, authenticated;
grant select on public.cashier_performance_summary to authenticated;
