alter table public.employees
  add column if not exists permissions jsonb not null default '[]'::jsonb;
