CREATE TABLE IF NOT EXISTS public.amazon_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin text UNIQUE NOT NULL,
  title text NOT NULL,
  image_url text,
  price_usd numeric,
  price_zar numeric,
  rating numeric,
  review_count integer,
  sales_rank integer,
  category text,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY amazon_products_select_authenticated ON public.amazon_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY amazon_products_admin_all ON public.amazon_products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_amazon_products_category ON public.amazon_products(category);
CREATE INDEX IF NOT EXISTS idx_amazon_products_sales_rank ON public.amazon_products(sales_rank);

CREATE TABLE IF NOT EXISTS public.amazon_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_categories text[] NOT NULL DEFAULT ARRAY['Electronics','Home & Kitchen','Sports & Outdoors','Beauty & Personal Care','Toys & Games','Clothing & Accessories'],
  bsr_threshold integer NOT NULL DEFAULT 10000,
  exchange_rate_zar_per_usd numeric NOT NULL DEFAULT 18.5,
  last_sync_at timestamptz,
  api_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.amazon_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ais_select_authenticated ON public.amazon_integration_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ais_admin_all ON public.amazon_integration_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.amazon_integration_settings (id) VALUES (gen_random_uuid())
  ON CONFLICT DO NOTHING;