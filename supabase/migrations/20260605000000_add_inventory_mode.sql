-- Add inventory_mode to businesses and stores to distinguish between product and service offerings
-- Valid values: 'products', 'services', 'both'

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS inventory_mode text DEFAULT 'products';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS inventory_mode text DEFAULT 'products';
