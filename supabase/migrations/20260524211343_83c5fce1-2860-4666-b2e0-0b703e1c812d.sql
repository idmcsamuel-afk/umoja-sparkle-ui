
-- 1) Extend members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS currency_code varchar(3) NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS country_code  varchar(2) NOT NULL DEFAULT 'ZA';

-- 2) Extend circle_bids
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS currency_code varchar(3) NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS amount_usd    numeric(12,2),
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(12,4);

-- 3) country_configs
CREATE TABLE IF NOT EXISTS public.country_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   varchar(2) NOT NULL UNIQUE,
  country_name   varchar(100) NOT NULL,
  currency_code  varchar(3) NOT NULL,
  currency_symbol varchar(5) NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  seed_min    integer NOT NULL,
  seed_max    integer NOT NULL,
  growth_min  integer NOT NULL,
  growth_max  integer NOT NULL,
  harvest_min integer NOT NULL,
  harvest_max integer NOT NULL,
  payment_gateways jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_kyc boolean NOT NULL DEFAULT false,
  max_monthly_contribution integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.country_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_configs_read_all_auth" ON public.country_configs;
CREATE POLICY "country_configs_read_all_auth"
  ON public.country_configs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "country_configs_admin_write" ON public.country_configs;
CREATE POLICY "country_configs_admin_write"
  ON public.country_configs FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_country_configs_touch ON public.country_configs;
CREATE TRIGGER trg_country_configs_touch
  BEFORE UPDATE ON public.country_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.country_configs
  (country_code, country_name, currency_code, currency_symbol, enabled,
   seed_min, seed_max, growth_min, growth_max, harvest_min, harvest_max, payment_gateways)
VALUES
  ('ZA','South Africa','ZAR','R',     true,  200,   2000,   2000,   10000,  10000,   50000,  '["paystack","eft","usdt"]'::jsonb),
  ('KE','Kenya',       'KES','KSh',   false, 1500,  15000,  15000,  75000,  75000,   375000, '["flutterwave","usdt"]'::jsonb),
  ('NG','Nigeria',     'NGN','₦',     false, 10000, 100000, 100000, 500000, 500000,  2500000,'["paystack","usdt"]'::jsonb),
  ('GH','Ghana',       'GHS','GH₵',   false, 15,    150,    150,    750,    750,     3750,   '["flutterwave","usdt"]'::jsonb)
ON CONFLICT (country_code) DO NOTHING;

-- 4) currency_rates
CREATE TABLE IF NOT EXISTS public.currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency varchar(3) NOT NULL,
  to_currency   varchar(3) NOT NULL,
  rate numeric(12,6) NOT NULL,
  effective_date timestamptz NOT NULL DEFAULT now(),
  source varchar(50) NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_currency_rates_pair_date
  ON public.currency_rates (from_currency, to_currency, effective_date DESC);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currency_rates_read_auth" ON public.currency_rates;
CREATE POLICY "currency_rates_read_auth"
  ON public.currency_rates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "currency_rates_admin_write" ON public.currency_rates;
CREATE POLICY "currency_rates_admin_write"
  ON public.currency_rates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.currency_rates (from_currency, to_currency, rate, source) VALUES
  ('ZAR','USD',0.0550,'seed'),
  ('KES','USD',0.0077,'seed'),
  ('NGN','USD',0.0013,'seed'),
  ('GHS','USD',0.0810,'seed');

-- 5) country waitlist
CREATE TABLE IF NOT EXISTS public.country_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  phone text,
  country_code varchar(2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_country_waitlist_country ON public.country_waitlist(country_code);

ALTER TABLE public.country_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_insert_anyone" ON public.country_waitlist;
CREATE POLICY "waitlist_insert_anyone"
  ON public.country_waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_admin_read" ON public.country_waitlist;
CREATE POLICY "waitlist_admin_read"
  ON public.country_waitlist FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "waitlist_admin_write" ON public.country_waitlist;
CREATE POLICY "waitlist_admin_write"
  ON public.country_waitlist FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
