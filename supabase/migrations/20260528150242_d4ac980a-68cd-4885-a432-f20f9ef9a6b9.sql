
ALTER TABLE public.country_configs ADD COLUMN IF NOT EXISTS monthly_price NUMERIC;

INSERT INTO public.country_configs
  (country_code, country_name, currency_code, currency_symbol, enabled,
   seed_min, seed_max, growth_min, growth_max, harvest_min, harvest_max,
   payment_gateways, monthly_price)
VALUES
  ('ZW','Zimbabwe','ZWL','ZWL$', true,  2000,20000, 20000,100000, 100000,500000, '["usdt"]'::jsonb,                4995),
  ('ZM','Zambia',  'ZMW','ZK',   true,  140,1400,   1400,7000,    7000,35000,    '["flutterwave","usdt"]'::jsonb,  699),
  ('MZ','Mozambique','MZN','MT', true,  800,8000,   8000,40000,   40000,200000,  '["usdt"]'::jsonb,                3996)
ON CONFLICT (country_code) DO NOTHING;

UPDATE public.country_configs SET monthly_price = 999  WHERE country_code='ZA' AND monthly_price IS NULL;
UPDATE public.country_configs SET monthly_price = 4995 WHERE country_code='NG' AND monthly_price IS NULL;
UPDATE public.country_configs SET monthly_price = 499  WHERE country_code='KE' AND monthly_price IS NULL;
UPDATE public.country_configs SET monthly_price = 399  WHERE country_code='GH' AND monthly_price IS NULL;
UPDATE public.country_configs SET enabled = true WHERE country_code IN ('NG','KE','GH');

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.product_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  membership_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_memberships TO authenticated;
GRANT ALL ON public.product_memberships TO service_role;
ALTER TABLE public.product_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_select_own ON public.product_memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY pm_insert_own ON public.product_memberships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY pm_update_own ON public.product_memberships FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY pm_delete_admin ON public.product_memberships FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.storefront_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  brand_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storefront_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_accounts TO authenticated;
GRANT ALL ON public.storefront_accounts TO service_role;
ALTER TABLE public.storefront_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sf_select_public ON public.storefront_accounts FOR SELECT USING (true);
CREATE POLICY sf_insert_own    ON public.storefront_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sf_update_own    ON public.storefront_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY sf_delete_admin  ON public.storefront_accounts FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.fulfillment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  roboost_zone TEXT,
  estimated_cost_per_unit NUMERIC,
  base_rate NUMERIC,
  weight_surcharge NUMERIC,
  handling_fee NUMERIC,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_config TO authenticated;
GRANT ALL ON public.fulfillment_config TO service_role;
ALTER TABLE public.fulfillment_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_select_own ON public.fulfillment_config FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY fc_insert_own ON public.fulfillment_config FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY fc_update_own ON public.fulfillment_config FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());

CREATE TABLE IF NOT EXISTS public.ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  auto_generate_listings BOOLEAN NOT NULL DEFAULT true,
  auto_social_posts      BOOLEAN NOT NULL DEFAULT true,
  auto_email_campaigns   BOOLEAN NOT NULL DEFAULT true,
  auto_optimize_pricing  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_preferences TO authenticated;
GRANT ALL ON public.ai_preferences TO service_role;
ALTER TABLE public.ai_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY aip_select_own ON public.ai_preferences FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());
CREATE POLICY aip_insert_own ON public.ai_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY aip_update_own ON public.ai_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin_user());

CREATE TRIGGER pm_set_updated BEFORE UPDATE ON public.product_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sf_set_updated BEFORE UPDATE ON public.storefront_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER fc_set_updated BEFORE UPDATE ON public.fulfillment_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER aip_set_updated BEFORE UPDATE ON public.ai_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
