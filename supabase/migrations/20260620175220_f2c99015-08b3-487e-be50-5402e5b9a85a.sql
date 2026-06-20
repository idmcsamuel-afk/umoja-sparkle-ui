CREATE TABLE IF NOT EXISTS public.takealot_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  takealot_name TEXT NOT NULL,
  takealot_price DECIMAL(10, 2),
  takealot_url TEXT,
  category TEXT,
  seller_count INT,
  rating DECIMAL(3, 1),
  image_url TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.takealot_products TO anon;
GRANT SELECT ON public.takealot_products TO authenticated;
GRANT ALL ON public.takealot_products TO service_role;

ALTER TABLE public.takealot_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read takealot products"
  ON public.takealot_products FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_takealot_scraped ON public.takealot_products(scraped_at);
CREATE INDEX IF NOT EXISTS idx_takealot_category ON public.takealot_products(category);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;