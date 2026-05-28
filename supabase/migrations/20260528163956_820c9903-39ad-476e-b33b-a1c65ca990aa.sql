
-- =========================================================
-- 1) MEMBERS: add country context columns
-- =========================================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_preference TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_partner_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT false;

-- Backfill existing members
UPDATE public.members
SET country = COALESCE(country, 'SA'),
    currency_code = COALESCE(currency_code, 'ZAR'),
    marketplace_preference = COALESCE(marketplace_preference, 'Takealot'),
    fulfillment_partner_available = COALESCE(fulfillment_partner_available, true),
    is_international = COALESCE(is_international, false)
WHERE country IS NULL
   OR currency_code IS NULL
   OR marketplace_preference IS NULL
   OR fulfillment_partner_available IS NULL
   OR is_international IS NULL;

-- RLS policies for members (own-row + admin read-all). Use DROP IF EXISTS to be idempotent.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_self_select" ON public.members;
CREATE POLICY "members_self_select"
ON public.members FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin_user());

DROP POLICY IF EXISTS "members_self_update" ON public.members;
CREATE POLICY "members_self_update"
ON public.members FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin_user())
WITH CHECK (auth.uid() = id OR public.is_admin_user());

-- =========================================================
-- 2) PRODUCT_FEEDS table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.product_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT,
  supplier_cost NUMERIC(12,2),
  local_retail_price NUMERIC(12,2),
  local_marketplace TEXT,
  local_search_volume INTEGER,
  local_competition_count INTEGER,
  trend_direction TEXT CHECK (trend_direction IN ('rising','stable','falling')),
  trend_percentage NUMERIC(6,2),
  ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_confidence NUMERIC(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),
  tier TEXT CHECK (tier IN ('BUY_NOW','BUY_SOON','COMING_WAVE')),
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_feeds_product_country_unique UNIQUE (product_id, country)
);

GRANT SELECT ON public.product_feeds TO authenticated;
GRANT ALL ON public.product_feeds TO service_role;

ALTER TABLE public.product_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_feeds_read_all_authenticated"
ON public.product_feeds FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "product_feeds_admin_insert"
ON public.product_feeds FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

CREATE POLICY "product_feeds_admin_update"
ON public.product_feeds FOR UPDATE
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "product_feeds_admin_delete"
ON public.product_feeds FOR DELETE
TO authenticated
USING (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_product_feeds_country_score
  ON public.product_feeds (country, ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_feeds_product_country
  ON public.product_feeds (product_id, country);

CREATE TRIGGER product_feeds_set_updated_at
BEFORE UPDATE ON public.product_feeds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3) Seed sample data (10 SA + 10 Nigeria)
-- =========================================================
WITH base(product_id, product_name, category, supplier_cost) AS (
  VALUES
    (gen_random_uuid(), 'Portable Phone Charger', 'Electronics', 45.00),
    (gen_random_uuid(), 'Solar Power Bank',       'Electronics', 30.00),
    (gen_random_uuid(), 'USB Hub',                'Electronics', 20.00),
    (gen_random_uuid(), 'Wireless Earbuds',       'Electronics', 80.00),
    (gen_random_uuid(), 'Bluetooth Speaker',      'Electronics', 95.00),
    (gen_random_uuid(), 'LED Desk Lamp',          'Home',        55.00),
    (gen_random_uuid(), 'Car Phone Mount',        'Automotive',  25.00),
    (gen_random_uuid(), 'Mini Air Humidifier',    'Home',        40.00),
    (gen_random_uuid(), 'Smart Watch Strap',      'Accessories', 18.00),
    (gen_random_uuid(), 'Insulated Water Bottle', 'Lifestyle',   35.00)
)
INSERT INTO public.product_feeds
  (product_id, country, product_name, category, supplier_cost, local_retail_price,
   local_marketplace, local_search_volume, local_competition_count,
   trend_direction, trend_percentage, ai_score, ai_confidence, tier, recommendation)
SELECT product_id, 'SA', product_name, category, supplier_cost,
       supplier_cost * 4,
       'Takealot',
       (5000 + (random()*15000))::int,
       (20 + (random()*180))::int,
       (ARRAY['rising','stable','falling'])[1 + floor(random()*3)::int],
       round((random()*60 - 10)::numeric, 2),
       (60 + floor(random()*40))::int,
       round((0.7 + random()*0.3)::numeric, 2),
       (ARRAY['BUY_NOW','BUY_SOON','COMING_WAVE'])[1 + floor(random()*3)::int],
       'Strong local demand on Takealot — solid margin opportunity.'
FROM base;

WITH base(product_id, product_name, category, supplier_cost, ngn_price) AS (
  VALUES
    (gen_random_uuid(), 'Portable Phone Charger', 'Electronics', 45.00, 8100.00),
    (gen_random_uuid(), 'Solar Power Bank',       'Electronics', 30.00, 6000.00),
    (gen_random_uuid(), 'USB Hub',                'Electronics', 20.00, 3200.00),
    (gen_random_uuid(), 'Wireless Earbuds',       'Electronics', 80.00, 14500.00),
    (gen_random_uuid(), 'Bluetooth Speaker',      'Electronics', 95.00, 17000.00),
    (gen_random_uuid(), 'LED Desk Lamp',          'Home',        55.00, 9800.00),
    (gen_random_uuid(), 'Car Phone Mount',        'Automotive',  25.00, 4500.00),
    (gen_random_uuid(), 'Mini Air Humidifier',    'Home',        40.00, 7200.00),
    (gen_random_uuid(), 'Smart Watch Strap',      'Accessories', 18.00, 3000.00),
    (gen_random_uuid(), 'Insulated Water Bottle', 'Lifestyle',   35.00, 6300.00)
)
INSERT INTO public.product_feeds
  (product_id, country, product_name, category, supplier_cost, local_retail_price,
   local_marketplace, local_search_volume, local_competition_count,
   trend_direction, trend_percentage, ai_score, ai_confidence, tier, recommendation)
SELECT product_id, 'Nigeria', product_name, category, supplier_cost, ngn_price,
       'Jumia',
       (8000 + (random()*22000))::int,
       (15 + (random()*120))::int,
       (ARRAY['rising','stable','falling'])[1 + floor(random()*3)::int],
       round((random()*80 - 5)::numeric, 2),
       (65 + floor(random()*35))::int,
       round((0.7 + random()*0.3)::numeric, 2),
       (ARRAY['BUY_NOW','BUY_SOON','COMING_WAVE'])[1 + floor(random()*3)::int],
       'High demand on Jumia Nigeria — strong margin in NGN.'
FROM base;
