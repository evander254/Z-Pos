-- Business-specific feature catalog and operational data layer.
-- The catalog maps each business type to enabled modules, while the generic
-- operation tables handle the industry workflows without creating dozens of
-- single-purpose tables that would be hard to maintain.

create table if not exists public.business_type_features (
  id uuid primary key default gen_random_uuid(),
  business_type text not null,
  feature_key text not null,
  feature_label text not null,
  operation_area text not null,
  description text,
  default_enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp default now(),
  unique (business_type, feature_key)
);

alter table public.business_type_features enable row level security;

drop policy if exists "business_type_features_read" on public.business_type_features;
create policy "business_type_features_read" on public.business_type_features
  for select using (true);

create table if not exists public.business_enabled_features (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  feature_id uuid not null references public.business_type_features(id) on delete cascade,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (business_id, feature_id)
);

alter table public.business_enabled_features enable row level security;

drop policy if exists "business_enabled_features_member_read" on public.business_enabled_features;
create policy "business_enabled_features_member_read" on public.business_enabled_features
  for select using (public.user_in_business(business_id));

drop policy if exists "business_enabled_features_manager_manage" on public.business_enabled_features;
create policy "business_enabled_features_manager_manage" on public.business_enabled_features
  for all using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create table if not exists public.business_operations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  feature_key text not null,
  operation_type text not null,
  status text not null default 'open',
  reference_no text,
  title text not null,
  notes text,
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  scheduled_at timestamp,
  due_at timestamp,
  completed_at timestamp,
  quantity numeric(12,3),
  amount numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (business_id, reference_no)
);

alter table public.business_operations enable row level security;

drop policy if exists "business_operations_member_read" on public.business_operations;
create policy "business_operations_member_read" on public.business_operations
  for select using (public.user_in_business(business_id));

drop policy if exists "business_operations_member_insert" on public.business_operations;
create policy "business_operations_member_insert" on public.business_operations
  for insert with check (public.user_in_business(business_id));

drop policy if exists "business_operations_member_update" on public.business_operations;
create policy "business_operations_member_update" on public.business_operations
  for update using (public.user_in_business(business_id))
  with check (public.user_in_business(business_id));

drop policy if exists "business_operations_manager_delete" on public.business_operations;
create policy "business_operations_manager_delete" on public.business_operations
  for delete using (public.user_has_business_role(business_id, array['owner','admin','manager']));

create table if not exists public.product_operation_details (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  detail_type text not null,
  serial_no text,
  imei text,
  batch_no text,
  variant_attributes jsonb not null default '{}'::jsonb,
  warranty_months integer,
  manufacture_date date,
  expiry_date date,
  unit_name text,
  unit_factor numeric(12,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp default now()
);

alter table public.product_operation_details enable row level security;

drop policy if exists "product_operation_details_member_read" on public.product_operation_details;
create policy "product_operation_details_member_read" on public.product_operation_details
  for select using (public.user_in_business(business_id));

drop policy if exists "product_operation_details_manage" on public.product_operation_details;
create policy "product_operation_details_manage" on public.product_operation_details
  for all using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create table if not exists public.customer_operation_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  profile_type text not null,
  preferences jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (business_id, customer_id, profile_type)
);

alter table public.customer_operation_profiles enable row level security;

drop policy if exists "customer_operation_profiles_member_all" on public.customer_operation_profiles;
create policy "customer_operation_profiles_member_all" on public.customer_operation_profiles
  for all using (public.user_in_business(business_id))
  with check (public.user_in_business(business_id));

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_store_id uuid references public.stores(id) on delete set null,
  to_store_id uuid references public.stores(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'pending',
  requested_by uuid references public.employees(id) on delete set null,
  approved_by uuid references public.employees(id) on delete set null,
  notes text,
  created_at timestamp default now(),
  completed_at timestamp
);

alter table public.stock_transfers enable row level security;

drop policy if exists "stock_transfers_member_read" on public.stock_transfers;
create policy "stock_transfers_member_read" on public.stock_transfers
  for select using (public.user_in_business(business_id));

drop policy if exists "stock_transfers_manage" on public.stock_transfers;
create policy "stock_transfers_manage" on public.stock_transfers
  for all using (public.user_has_business_role(business_id, array['owner','admin','manager']))
  with check (public.user_has_business_role(business_id, array['owner','admin','manager']));

create index if not exists idx_business_type_features_type on public.business_type_features(business_type);
create index if not exists idx_business_enabled_features_business on public.business_enabled_features(business_id);
create index if not exists idx_business_operations_business_type on public.business_operations(business_id, operation_type, status);
create index if not exists idx_business_operations_schedule on public.business_operations(business_id, scheduled_at) where scheduled_at is not null;
create index if not exists idx_product_operation_details_product on public.product_operation_details(product_id, detail_type);
create unique index if not exists idx_product_operation_details_imei_unique
  on public.product_operation_details(business_id, imei) where imei is not null;
create unique index if not exists idx_product_operation_details_serial_unique
  on public.product_operation_details(business_id, serial_no) where serial_no is not null;
create index if not exists idx_stock_transfers_business_status on public.stock_transfers(business_id, status, created_at desc);

insert into public.business_type_features (business_type, feature_key, feature_label, operation_area, description, metadata) values
  ('supermarket','barcode_generation','Barcode generation','inventory','Generate and manage product barcodes.', '{"record_table":"products","fields":["barcode","sku"]}'),
  ('supermarket','shelf_price_labels','Shelf price labels','merchandising','Print shelf labels and price tags.', '{"operation_type":"label_print"}'),
  ('supermarket','loyalty_cards','Loyalty cards','customers','Issue and track loyalty cards.', '{"profile_type":"loyalty_card"}'),
  ('supermarket','basket_analysis','Basket analysis','analytics','Analyze products commonly bought together.', '{"source":"sale_items"}'),
  ('supermarket','buy_x_get_y_promotions','Buy X Get Y promotions','promotions','Run Buy 2 Get 1 and similar promotions.', '{"operation_type":"promotion"}'),
  ('supermarket','branch_stock_transfers','Branch stock transfers','inventory','Move stock between branches.', '{"record_table":"stock_transfers"}'),
  ('supermarket','supplier_rebates','Supplier rebates','suppliers','Track supplier rebate claims.', '{"operation_type":"supplier_rebate"}'),
  ('electronics','imei_serial_tracking','IMEI/Serial tracking','inventory','Track IMEI and serial numbers per device.', '{"detail_type":"identifier"}'),
  ('electronics','warranty_management','Warranty management','after_sales','Store warranty periods and claims.', '{"operation_type":"warranty_claim"}'),
  ('electronics','repair_tickets','Repair tickets','service','Open and manage repair jobs.', '{"operation_type":"repair_ticket"}'),
  ('electronics','trade_in_devices','Trade-in devices','sales','Record trade-in valuations and resale status.', '{"operation_type":"trade_in"}'),
  ('electronics','accessory_bundling','Accessory bundling','sales','Bundle accessories with devices.', '{"operation_type":"bundle"}'),
  ('electronics','device_activation_records','Device activation records','compliance','Record device activations after sale.', '{"operation_type":"activation"}'),
  ('boutique','color_size_matrix','Color-size matrix','inventory','Manage product variants by color and size.', '{"detail_type":"variant"}'),
  ('boutique','seasonal_collections','Seasonal collections','merchandising','Group stock by collection and season.', '{"operation_type":"collection"}'),
  ('boutique','fitting_room_tracking','Fitting room tracking','store_ops','Track fitting room items and conversions.', '{"operation_type":"fitting_room"}'),
  ('boutique','fashion_lookbooks','Fashion lookbooks','merchandising','Build outfits and visual catalogs.', '{"operation_type":"lookbook"}'),
  ('boutique','style_profiles','Customer style profiles','customers','Store sizes, colors, and style preferences.', '{"profile_type":"style"}'),
  ('boutique','return_reason_analysis','Return reasons analysis','analytics','Capture and analyze return reasons.', '{"operation_type":"return_reason"}'),
  ('pharmacy','batch_tracking','Batch tracking','inventory','Track medicine batches and lot numbers.', '{"detail_type":"batch"}'),
  ('pharmacy','expiry_alerts','Expiry alerts','inventory','Monitor expiry dates and alerts.', '{"detail_type":"expiry"}'),
  ('pharmacy','prescription_uploads','Prescription uploads','clinical','Attach prescription records to customers.', '{"operation_type":"prescription"}'),
  ('pharmacy','controlled_medicine_logs','Controlled medicine logs','compliance','Maintain controlled drug dispensing logs.', '{"operation_type":"controlled_medicine_log"}'),
  ('pharmacy','drug_interaction_warnings','Drug interaction warnings','clinical','Record warning rules and interactions.', '{"operation_type":"drug_interaction"}'),
  ('pharmacy','patient_purchase_history','Patient purchase history','customers','Review medication purchase history.', '{"source":"sales"}'),
  ('restaurant','table_reservations','Table reservations','hospitality','Manage reservations and table bookings.', '{"operation_type":"reservation"}'),
  ('restaurant','kitchen_display_system','Kitchen display system','kitchen','Send orders to KDS queues.', '{"operation_type":"kds_order"}'),
  ('restaurant','waiter_accounts','Waiter accounts','staff','Assign orders to waiter accounts.', '{"source":"employees"}'),
  ('restaurant','split_bills','Split bills','checkout','Split bills across guests or payments.', '{"operation_type":"split_bill"}'),
  ('restaurant','combo_meals','Combo meals','menu','Create combo meal bundles.', '{"operation_type":"combo_meal"}'),
  ('restaurant','recipe_costing','Recipe costing','inventory','Cost recipes from ingredients.', '{"operation_type":"recipe"}'),
  ('restaurant','ingredient_deduction','Ingredient deduction','inventory','Deduct ingredients when menu items sell.', '{"operation_type":"ingredient_deduction"}'),
  ('cafe','quick_order_screen','Quick order screen','checkout','Prioritize fast counter orders.', '{"ui":"quick_order"}'),
  ('cafe','custom_modifiers','Custom modifiers','menu','Manage modifiers like soy milk or extra sugar.', '{"operation_type":"modifier"}'),
  ('cafe','barista_queue','Barista queue','kitchen','Queue drinks for baristas.', '{"operation_type":"barista_queue"}'),
  ('cafe','loyalty_stamps','Loyalty stamps','customers','Track stamps and free drinks.', '{"profile_type":"stamp_card"}'),
  ('cafe','takeaway_dinein_reporting','Takeaway vs dine-in reporting','analytics','Report orders by fulfillment mode.', '{"operation_type":"fulfillment_mode"}'),
  ('hardware','unit_conversion','Unit conversion','inventory','Convert meters, rolls, kilos, and packs.', '{"detail_type":"unit_conversion"}'),
  ('hardware','cutting_services','Cutting services tracking','service','Track cutting jobs and measurements.', '{"operation_type":"cutting_service"}'),
  ('hardware','project_quotations','Project quotations','sales','Create quotes for projects.', '{"operation_type":"quotation"}'),
  ('hardware','contractor_accounts','Contractor accounts','customers','Manage contractor profiles and terms.', '{"profile_type":"contractor"}'),
  ('hardware','bulk_pricing','Bulk pricing','sales','Set bulk pricing breaks.', '{"operation_type":"bulk_pricing"}'),
  ('cosmetics','shade_skin_tone_catalogs','Shade/skin-tone catalogs','catalog','Manage shade and skin tone attributes.', '{"detail_type":"shade"}'),
  ('cosmetics','beauty_consultations','Beauty consultations','service','Record consultation notes and recommendations.', '{"operation_type":"beauty_consultation"}'),
  ('cosmetics','skin_profiles','Customer skin profiles','customers','Store skin type, tone, allergies, and preferences.', '{"profile_type":"skin"}'),
  ('cosmetics','brand_campaigns','Brand campaigns','marketing','Track brand campaigns and promos.', '{"operation_type":"brand_campaign"}'),
  ('cosmetics','expiry_management','Expiry management','inventory','Track cosmetic expiry and shelf life.', '{"detail_type":"expiry"}'),
  ('liquor','age_verification','Age verification','compliance','Record age checks for restricted sales.', '{"operation_type":"age_check"}'),
  ('liquor','bottle_deposits','Bottle deposit tracking','inventory','Track bottle deposits and returns.', '{"operation_type":"bottle_deposit"}'),
  ('liquor','license_compliance','License compliance reports','compliance','Track license checks and reports.', '{"operation_type":"license_report"}'),
  ('liquor','happy_hour_pricing','Happy-hour pricing','promotions','Configure time-based discounts.', '{"operation_type":"happy_hour"}'),
  ('liquor','case_bottle_conversion','Case/bottle conversion','inventory','Convert cases to individual bottles.', '{"detail_type":"unit_conversion"}'),
  ('wholesale','credit_limits','Customer credit limits','credit','Set customer credit limits.', '{"profile_type":"credit"}'),
  ('wholesale','debt_management','Debt management','credit','Track debts and repayments.', '{"source":"credit_ledger"}'),
  ('wholesale','tiered_pricing','Tiered pricing','sales','Set pricing tiers by customer or volume.', '{"operation_type":"tiered_pricing"}'),
  ('wholesale','truck_dispatch','Truck dispatch','logistics','Schedule dispatch trucks and routes.', '{"operation_type":"truck_dispatch"}'),
  ('wholesale','delivery_notes','Delivery notes','logistics','Generate and track delivery notes.', '{"operation_type":"delivery_note"}'),
  ('wholesale','vat_invoices','VAT invoices','compliance','Issue VAT-compliant invoices.', '{"operation_type":"vat_invoice"}'),
  ('wholesale','b2b_ordering','B2B ordering','sales','Manage B2B orders and approvals.', '{"operation_type":"b2b_order"}'),
  ('agrovet','seasonal_forecasting','Seasonal demand forecasting','analytics','Forecast seasonal farm inputs demand.', '{"operation_type":"forecast"}'),
  ('agrovet','livestock_medicine_tracking','Livestock medicine tracking','inventory','Track animal medication batches and usage.', '{"detail_type":"livestock_medicine"}'),
  ('agrovet','farmer_accounts','Farmer accounts','customers','Manage farmer profiles and farms.', '{"profile_type":"farmer"}'),
  ('agrovet','veterinary_consultations','Veterinary consultation records','service','Record veterinary consultations.', '{"operation_type":"vet_consultation"}'),
  ('agrovet','crop_calendar','Crop calendar','planning','Plan farm activities by crop season.', '{"operation_type":"crop_calendar"}'),
  ('salon','appointment_scheduling','Appointment scheduling','bookings','Schedule appointments and services.', '{"operation_type":"appointment"}'),
  ('salon','chair_management','Chair management','store_ops','Manage chair availability and utilization.', '{"operation_type":"chair_booking"}'),
  ('salon','stylist_commissions','Stylist commissions','staff','Track commissions by stylist.', '{"operation_type":"commission"}'),
  ('salon','before_after_photos','Before/after photos','service','Attach before and after service photos.', '{"operation_type":"service_photo"}'),
  ('salon','package_memberships','Package memberships','customers','Manage memberships and service packages.', '{"profile_type":"membership"}'),
  ('salon','sms_reminders','SMS reminders','communications','Queue appointment reminders.', '{"operation_type":"sms_reminder"}'),
  ('cyber','pc_timer_control','PC timer control','workstations','Track timed PC sessions.', '{"operation_type":"pc_session"}'),
  ('cyber','printing_management','Printing management','services','Track print jobs and charges.', '{"operation_type":"print_job"}'),
  ('cyber','scanning_services','Scanning services','services','Track scanning jobs and pricing.', '{"operation_type":"scan_job"}'),
  ('cyber','internet_packages','Internet packages','services','Sell timed or metered internet packages.', '{"operation_type":"internet_package"}'),
  ('cyber','workstation_monitoring','Workstation monitoring','workstations','Monitor workstation status.', '{"operation_type":"workstation_status"}'),
  ('mpesa','float_management','Float management','finance','Track cash and e-money float movements.', '{"operation_type":"float_movement"}'),
  ('mpesa','agent_till_tracking','Agent till tracking','finance','Track transactions per agent till.', '{"operation_type":"agent_till"}'),
  ('mpesa','commission_reports','Commission reports','finance','Report commissions by service.', '{"operation_type":"commission_report"}'),
  ('mpesa','cash_reconciliation','Cash reconciliation','finance','Reconcile cash against transactions.', '{"operation_type":"cash_reconciliation"}'),
  ('mpesa','daily_float_balancing','Daily float balancing','finance','Balance opening and closing float.', '{"operation_type":"float_balance"}'),
  ('mpesa','fraud_alerts','Fraud alerts','risk','Record suspicious transaction alerts.', '{"operation_type":"fraud_alert"}'),
  ('minimart','fast_checkout','Fast checkout','checkout','Optimize checkout for small baskets.', '{"ui":"fast_checkout"}'),
  ('minimart','simplified_inventory','Simplified inventory','inventory','Keep simple stock counts and costs.', '{"source":"products"}'),
  ('minimart','loyalty_points','Loyalty points','customers','Award and redeem loyalty points.', '{"source":"customers"}'),
  ('minimart','low_stock_alerts','Low-stock alerts','inventory','Alert when products need restocking.', '{"source":"products.low_stock_alert"}'),
  ('minimart','supplier_restocking','Supplier restocking suggestions','suppliers','Suggest supplier restocking from movement.', '{"operation_type":"restock_suggestion"}'),
  ('other','custom_modules','Custom modules','custom','Configure custom modules for the business.', '{"operation_type":"custom_module"}'),
  ('other','invoicing','Invoicing','billing','Create and track invoices.', '{"operation_type":"invoice"}'),
  ('other','bookings','Bookings','bookings','Schedule bookings and appointments.', '{"operation_type":"booking"}'),
  ('other','subscriptions','Subscriptions','billing','Manage recurring customer subscriptions.', '{"operation_type":"subscription"}'),
  ('other','service_tickets','Service tickets','service','Track customer service requests.', '{"operation_type":"service_ticket"}')
on conflict (business_type, feature_key) do update set
  feature_label = excluded.feature_label,
  operation_area = excluded.operation_area,
  description = excluded.description,
  metadata = excluded.metadata;

create or replace function public.initialize_business_features(_business_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.business_enabled_features (business_id, feature_id, enabled)
  select b.id, f.id, f.default_enabled
  from public.businesses b
  join public.business_type_features f on f.business_type = b.business_type
  where b.id = _business_id
  on conflict (business_id, feature_id) do nothing;
$$;

create or replace function public.get_business_enabled_features(_business_id uuid)
returns table (
  feature_key text,
  feature_label text,
  operation_area text,
  description text,
  enabled boolean,
  settings jsonb,
  metadata jsonb
) language sql stable security definer set search_path = public as $$
  select
    f.feature_key,
    f.feature_label,
    f.operation_area,
    f.description,
    bef.enabled,
    bef.settings,
    f.metadata
  from public.business_enabled_features bef
  join public.business_type_features f on f.id = bef.feature_id
  where bef.business_id = _business_id
    and public.user_in_business(_business_id)
  order by f.operation_area, f.feature_label;
$$;

create or replace function public.create_business_operation(
  _business_id uuid,
  _feature_key text,
  _operation_type text,
  _title text,
  _metadata jsonb default '{}'::jsonb,
  _customer_id uuid default null,
  _product_id uuid default null,
  _amount numeric default null,
  _quantity numeric default null,
  _scheduled_at timestamp default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _operation_id uuid;
begin
  if not public.user_in_business(_business_id) then
    raise exception 'Not authorized for this business';
  end if;

  if not exists (
    select 1
    from public.business_enabled_features bef
    join public.business_type_features f on f.id = bef.feature_id
    where bef.business_id = _business_id
      and f.feature_key = _feature_key
      and bef.enabled
  ) then
    raise exception 'Feature is not enabled for this business';
  end if;

  insert into public.business_operations (
    business_id,
    feature_key,
    operation_type,
    title,
    metadata,
    customer_id,
    product_id,
    amount,
    quantity,
    scheduled_at
  ) values (
    _business_id,
    _feature_key,
    _operation_type,
    _title,
    coalesce(_metadata, '{}'::jsonb),
    _customer_id,
    _product_id,
    _amount,
    _quantity,
    _scheduled_at
  ) returning id into _operation_id;

  return _operation_id;
end; $$;

create or replace function public.handle_business_features_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.initialize_business_features(new.id);
  return new;
end; $$;

drop trigger if exists on_business_created_initialize_features on public.businesses;
create trigger on_business_created_initialize_features
  after insert on public.businesses
  for each row execute function public.handle_business_features_created();

select public.initialize_business_features(id) from public.businesses;
