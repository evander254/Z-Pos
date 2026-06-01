-- Add delivery_days to suppliers
ALTER TABLE public.suppliers
ADD COLUMN delivery_days text;

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null,
  unit_cost numeric(10,2) not null,
  created_at timestamp default now()
);

ALTER TABLE public.purchase_order_items enable row level security;

-- Add policies for purchase_order_items
CREATE POLICY "po_items_manage" on public.purchase_order_items for all
  using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_id and public.user_has_business_role(po.business_id, array['owner','admin','manager'])
    )
  )
  with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = po_id and public.user_has_business_role(po.business_id, array['owner','admin','manager'])
    )
  );

-- Index for fast lookup
CREATE INDEX idx_po_items_po ON public.purchase_order_items(po_id);
