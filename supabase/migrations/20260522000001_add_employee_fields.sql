-- Add new columns to public.employees table
alter table public.employees add column if not exists username text;
alter table public.employees add column if not exists id_number text;
alter table public.employees add column if not exists id_document_url text;
alter table public.employees add column if not exists account_number text;
alter table public.employees add column if not exists work_account_number text;
alter table public.employees add column if not exists password_plain text;
alter table public.employees add column if not exists email text;

-- Add unique constraint for work_account_number if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_work_account_number_key'
  ) then
    alter table public.employees add constraint employees_work_account_number_key unique (work_account_number);
  end if;
end $$;

-- Create buckets for employee documents and profile pictures
insert into storage.buckets (id, name, public)
values 
  ('IDs', 'IDs', true),
  ('profiles', 'profiles', true)
on conflict (id) do nothing;

-- RLS policies for IDs bucket
create policy "Public Access to IDs"
on storage.objects for select
using ( bucket_id = 'IDs' );

create policy "Authenticated Upload to IDs"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'IDs' );

create policy "Authenticated Update to IDs"
on storage.objects for update
to authenticated
using ( bucket_id = 'IDs' );

create policy "Authenticated Delete to IDs"
on storage.objects for delete
to authenticated
using ( bucket_id = 'IDs' );

-- RLS policies for profiles bucket
create policy "Public Access to Profiles Bucket"
on storage.objects for select
using ( bucket_id = 'profiles' );

create policy "Authenticated Upload to Profiles Bucket"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'profiles' );

create policy "Authenticated Update to Profiles Bucket"
on storage.objects for update
to authenticated
using ( bucket_id = 'profiles' );

create policy "Authenticated Delete to Profiles Bucket"
on storage.objects for delete
to authenticated
using ( bucket_id = 'profiles' );
