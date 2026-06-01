-- Add supplier_id to products table
ALTER TABLE public.products
ADD COLUMN supplier_id uuid references public.suppliers(id) on delete set null;
