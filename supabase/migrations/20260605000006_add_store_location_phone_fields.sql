alter table public.stores
  add column if not exists location_address text,
  add column if not exists location_city text,
  add column if not exists location_county text,
  add column if not exists location_country text,
  add column if not exists location_postal_code text,
  add column if not exists latitude decimal(10,8),
  add column if not exists longitude decimal(11,8),
  add column if not exists google_place_id text,
  add column if not exists country_code varchar(10),
  add column if not exists country_iso varchar(5),
  add column if not exists phone_number varchar(30),
  add column if not exists full_phone_number varchar(40);

update public.stores
set location_address = coalesce(location_address, location)
where location is not null;

update public.stores
set full_phone_number = coalesce(full_phone_number, phone)
where phone is not null;

create index if not exists idx_stores_google_place_id on public.stores(google_place_id);
create index if not exists idx_stores_location_country on public.stores(location_country);
