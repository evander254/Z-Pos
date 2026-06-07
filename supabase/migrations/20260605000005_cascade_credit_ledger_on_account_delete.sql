alter table public.credit_ledger
  drop constraint if exists credit_ledger_business_id_fkey,
  drop constraint if exists credit_ledger_customer_id_fkey;

alter table public.credit_ledger
  add constraint credit_ledger_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete cascade,
  add constraint credit_ledger_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete cascade;
