-- Track when purchase orders are received so supplier lead time can be calculated accurately.
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS received_at timestamptz;
