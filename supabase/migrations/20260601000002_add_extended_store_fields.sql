-- Add additional fields to the stores table for detailed management
alter table public.stores
add column store_type text,
add column active boolean default true,
add column phone text,
add column email text,
add column manager_name text;
