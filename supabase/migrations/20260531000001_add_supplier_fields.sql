-- Add provided_items to suppliers
ALTER TABLE public.suppliers
ADD COLUMN provided_items text;
