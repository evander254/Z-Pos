-- Store custom purchase order item names when the item is not linked to a product.
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS product_name text;
