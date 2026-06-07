-- Use businesses.slug as the public tenant subdomain, e.g. slug.zpos.com.
-- This migration normalizes legacy slugs, protects future slugs, and exposes
-- a small helper for building the public shop login URL.

create or replace function public.normalize_business_subdomain_slug(raw_value text, fallback_id uuid default gen_random_uuid())
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(raw_value, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'business-' || left(replace(fallback_id::text, '-', ''), 8)
  )
$$;

with normalized as (
  select
    id,
    public.normalize_business_subdomain_slug(slug, id) as normalized_slug
  from public.businesses
), numbered as (
  select
    id,
    normalized_slug,
    row_number() over (partition by normalized_slug order by id) as duplicate_number
  from normalized
)
update public.businesses b
set slug = case
  when n.duplicate_number = 1 then left(n.normalized_slug, 63)
  else left(n.normalized_slug, 54) || '-' || left(replace(b.id::text, '-', ''), 8)
end
from numbered n
where b.id = n.id
  and b.slug is distinct from case
    when n.duplicate_number = 1 then left(n.normalized_slug, 63)
    else left(n.normalized_slug, 54) || '-' || left(replace(b.id::text, '-', ''), 8)
  end;

alter table public.businesses
  drop constraint if exists businesses_slug_subdomain_format_check;

alter table public.businesses
  add constraint businesses_slug_subdomain_format_check
  check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    and slug not in ('www', 'app', 'api', 'admin', 'auth', 'mail', 'support', 'help')
  );

create unique index if not exists businesses_slug_unique_idx
  on public.businesses (slug);

create or replace function public.business_subdomain_url(business_slug text, base_domain text default 'zpos.com')
returns text
language sql
immutable
set search_path = public
as $$
  select 'https://' || business_slug || '.' || regexp_replace(base_domain, '^https?://', '')
$$;
