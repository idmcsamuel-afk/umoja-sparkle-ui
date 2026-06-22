CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  asin TEXT NOT NULL,
  price_usd NUMERIC,
  monthly_rank INTEGER,
  review_count INTEGER,
  seller_count INTEGER,
  rating NUMERIC,
  search_volume INTEGER,
  related_keywords JSONB,
  competition_level TEXT,
  profit_potential TEXT,
  region TEXT DEFAULT 'US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asin, category, region)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);
