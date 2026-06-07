-- System Settings module for enterprise POS configuration.
-- One settings row is stored per business, with JSONB used for structured
-- options that are expected to evolve without requiring frequent migrations.

alter table public.businesses
  add column if not exists business_slogan text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists country text default 'Kenya',
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website_url text,
  add column if not exists registration_number text,
  add column if not exists tax_pin_vat_number text,
  add column if not exists currency_symbol text default 'KSh',
  add column if not exists decimal_places integer default 2,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.business_system_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,

  -- Financial Settings
  currency text not null default 'KES',
  currency_symbol text not null default 'KSh',
  decimal_places integer not null default 2 check (decimal_places between 0 and 4),
  default_tax_rate numeric(5,2) not null default 16.00 check (default_tax_rate >= 0 and default_tax_rate <= 100),
  tax_pricing_mode text not null default 'exclusive' check (tax_pricing_mode in ('inclusive', 'exclusive')),
  max_discount_percentage numeric(5,2) not null default 0 check (max_discount_percentage >= 0 and max_discount_percentage <= 100),
  max_refund_amount numeric(12,2) not null default 0 check (max_refund_amount >= 0),
  refund_policy text,

  -- Loyalty & Rewards
  points_per_amount_spent numeric(10,4) not null default 1 check (points_per_amount_spent >= 0),
  loyalty_amount_basis numeric(12,2) not null default 100 check (loyalty_amount_basis > 0),
  redemption_rate numeric(10,4) not null default 1 check (redemption_rate >= 0),
  minimum_redeemable_points integer not null default 0 check (minimum_redeemable_points >= 0),
  points_expiry_days integer check (points_expiry_days is null or points_expiry_days >= 0),
  birthday_rewards_enabled boolean not null default false,
  birthday_reward_points integer not null default 0 check (birthday_reward_points >= 0),
  membership_levels jsonb not null default '[]'::jsonb,

  -- User & Cashier Management
  cashier_login_start_time time,
  cashier_login_end_time time,
  allowed_working_days text[] not null default array['mon','tue','wed','thu','fri','sat','sun'],
  password_rules jsonb not null default '{"minLength":8,"requireUppercase":true,"requireLowercase":true,"requireNumber":true,"requireSymbol":false}'::jsonb,
  two_factor_auth_enabled boolean not null default false,

  -- Appearance & Branding
  primary_color text not null default '#6366f1',
  secondary_color text not null default '#8b5cf6',
  sidebar_color text not null default '#111827',
  color_mode text not null default 'system' check (color_mode in ('light', 'dark', 'system')),
  receipt_logo_url text,
  receipt_footer_message text,

  -- Receipt Settings
  receipt_width text not null default '80mm' check (receipt_width in ('58mm', '80mm', 'a4')),
  receipt_header text,
  receipt_footer text,
  show_tax_breakdown boolean not null default true,
  show_cashier_name boolean not null default true,
  show_loyalty_points boolean not null default true,
  show_receipt_qr_code boolean not null default false,
  show_receipt_barcode boolean not null default false,

  -- Inventory Settings
  low_stock_alert_threshold integer not null default 5 check (low_stock_alert_threshold >= 0),
  auto_reorder_level integer not null default 0 check (auto_reorder_level >= 0),
  negative_stock_control text not null default 'block' check (negative_stock_control in ('allow', 'warn', 'block')),
  product_expiry_alert_days integer not null default 30 check (product_expiry_alert_days >= 0),
  batch_tracking_enabled boolean not null default false,

  -- Sales Settings
  allow_backdated_sales boolean not null default false,
  allow_price_override boolean not null default false,
  allow_open_pricing boolean not null default false,
  credit_sales_enabled boolean not null default false,
  quotations_enabled boolean not null default false,
  proforma_invoices_enabled boolean not null default false,

  -- Notifications
  low_stock_notifications boolean not null default true,
  daily_sales_summary boolean not null default false,
  weekly_sales_report boolean not null default false,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  whatsapp_notifications boolean not null default false,

  -- Backup & Security
  automatic_backups boolean not null default false,
  backup_frequency text not null default 'daily' check (backup_frequency in ('hourly', 'daily', 'weekly', 'monthly')),
  session_timeout_minutes integer not null default 60 check (session_timeout_minutes between 5 and 1440),
  audit_logs_enabled boolean not null default true,
  login_history_enabled boolean not null default true,
  device_management_enabled boolean not null default false,
  ip_restrictions_enabled boolean not null default false,

  -- Branch Management
  multi_branch_support boolean not null default false,
  default_branch_manager_id uuid references public.profiles(id) on delete set null,
  branch_targets jsonb not null default '{}'::jsonb,
  branch_specific_taxes boolean not null default false,

  -- Payment Settings
  payment_methods jsonb not null default '{"cash":true,"mpesa":true,"airtelMoney":false,"card":false,"bankTransfer":false,"giftCards":false,"storeCredit":false}'::jsonb,

  -- Integrations
  integrations jsonb not null default '{"mpesaApi":{"enabled":false},"smsGateway":{"enabled":false},"whatsappApi":{"enabled":false},"accountingSoftware":{"enabled":false}}'::jsonb,

  -- Analytics Settings
  sales_forecasting_enabled boolean not null default false,
  slow_moving_stock_detection boolean not null default true,
  customer_purchase_trends boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_system_settings enable row level security;

create index if not exists idx_business_system_settings_business_id
  on public.business_system_settings (business_id);

create table if not exists public.system_settings_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  setting_group text not null,
  setting_key text,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.system_settings_audit_logs enable row level security;

create index if not exists idx_system_settings_audit_logs_business_created
  on public.system_settings_audit_logs (business_id, created_at desc);

create table if not exists public.business_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  device_name text,
  device_fingerprint text not null,
  trusted boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, device_fingerprint)
);

alter table public.business_devices enable row level security;

create index if not exists idx_business_devices_business_id
  on public.business_devices (business_id);

create table if not exists public.business_ip_restrictions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text,
  ip_address inet not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, ip_address)
);

alter table public.business_ip_restrictions enable row level security;

create index if not exists idx_business_ip_restrictions_business_id
  on public.business_ip_restrictions (business_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_businesses_updated_at on public.businesses;
create trigger touch_businesses_updated_at
  before update on public.businesses
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_business_system_settings_updated_at on public.business_system_settings;
create trigger touch_business_system_settings_updated_at
  before update on public.business_system_settings
  for each row execute function public.touch_updated_at();

create or replace function public.create_default_business_system_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_system_settings (
    business_id,
    currency,
    currency_symbol,
    decimal_places,
    default_tax_rate,
    primary_color,
    receipt_logo_url
  ) values (
    new.id,
    coalesce(new.currency, 'KES'),
    coalesce(new.currency_symbol, 'KSh'),
    coalesce(new.decimal_places, 2),
    coalesce(new.tax_rate, 16.00),
    coalesce(new.theme_color, '#6366f1'),
    new.logo_url
  ) on conflict (business_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_business_system_settings_trigger on public.businesses;
create trigger create_default_business_system_settings_trigger
  after insert on public.businesses
  for each row execute function public.create_default_business_system_settings();

insert into public.business_system_settings (
  business_id,
  currency,
  currency_symbol,
  decimal_places,
  default_tax_rate,
  primary_color,
  receipt_logo_url
)
select
  b.id,
  coalesce(b.currency, 'KES'),
  coalesce(b.currency_symbol, 'KSh'),
  coalesce(b.decimal_places, 2),
  coalesce(b.tax_rate, 16.00),
  coalesce(b.theme_color, '#6366f1'),
  b.logo_url
from public.businesses b
on conflict (business_id) do nothing;

create policy "business_settings_member_read" on public.business_system_settings
  for select using (public.user_in_business(business_id));

create policy "business_settings_owner_admin_manage" on public.business_system_settings
  for all
  using (public.user_has_business_role(business_id, array['owner','admin']))
  with check (public.user_has_business_role(business_id, array['owner','admin']));

create policy "settings_audit_owner_admin_read" on public.system_settings_audit_logs
  for select using (public.user_has_business_role(business_id, array['owner','admin']));

create policy "settings_audit_member_create" on public.system_settings_audit_logs
  for insert with check (public.user_in_business(business_id));

create policy "business_devices_owner_admin_manage" on public.business_devices
  for all
  using (public.user_has_business_role(business_id, array['owner','admin']))
  with check (public.user_has_business_role(business_id, array['owner','admin']));

create policy "business_ip_restrictions_owner_admin_manage" on public.business_ip_restrictions
  for all
  using (public.user_has_business_role(business_id, array['owner','admin']))
  with check (public.user_has_business_role(business_id, array['owner','admin']));
