-- Add description column to businesses table
alter table public.businesses add column if not exists description text;

-- Create businesslogos bucket if not exists
insert into storage.buckets (id, name, public)
values ('businesslogos', 'businesslogos', true)
on conflict (id) do nothing;

-- RLS policies for businesslogos bucket
create policy "Public Access to Business Logos"
on storage.objects for select
using ( bucket_id = 'businesslogos' );

create policy "Authenticated Upload to Business Logos"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'businesslogos' );

create policy "Authenticated Update to Business Logos"
on storage.objects for update
to authenticated
using ( bucket_id = 'businesslogos' );

create policy "Authenticated Delete to Business Logos"
on storage.objects for delete
to authenticated
using ( bucket_id = 'businesslogos' );
