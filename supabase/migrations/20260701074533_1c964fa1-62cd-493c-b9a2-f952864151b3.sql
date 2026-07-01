ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_count_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buybox_price numeric,
  ADD COLUMN IF NOT EXISTS buybox_currency text;