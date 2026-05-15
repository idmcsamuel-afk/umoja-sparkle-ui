ALTER TABLE public.amazon_products
  ADD COLUMN IF NOT EXISTS sa_available boolean,
  ADD COLUMN IF NOT EXISTS sa_price_zar numeric,
  ADD COLUMN IF NOT EXISTS import_cost_zar numeric,
  ADD COLUMN IF NOT EXISTS price_advantage numeric,
  ADD COLUMN IF NOT EXISTS opportunity_score integer;

CREATE INDEX IF NOT EXISTS idx_amazon_products_opportunity_score
  ON public.amazon_products (opportunity_score DESC);