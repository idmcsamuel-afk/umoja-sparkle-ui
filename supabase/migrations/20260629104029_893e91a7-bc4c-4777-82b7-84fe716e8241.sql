
-- 1. Spark Trade opportunities: margin engine columns
ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS alibaba_cost_zar numeric,
  ADD COLUMN IF NOT EXISTS buffer_pct numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS freight_cost_zar numeric,
  ADD COLUMN IF NOT EXISTS umoja_commission_zar numeric,
  ADD COLUMN IF NOT EXISTS commission_pct numeric DEFAULT 8,
  ADD COLUMN IF NOT EXISTS landed_cost_zar numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_zar numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS marketplace text,
  ADD COLUMN IF NOT EXISTS source_product_url text;

ALTER TABLE public.spark_trade_opportunities
  ALTER COLUMN expected_margin_percentage TYPE numeric USING expected_margin_percentage::numeric;

-- 2. Settings table for margin defaults
CREATE TABLE IF NOT EXISTS public.spark_trade_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spark_trade_settings TO authenticated;
GRANT ALL ON public.spark_trade_settings TO service_role;

ALTER TABLE public.spark_trade_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings readable by authenticated"
  ON public.spark_trade_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings writable by admins"
  ON public.spark_trade_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

INSERT INTO public.spark_trade_settings (key, value) VALUES
  ('default_buffer_pct', 10),
  ('default_commission_pct', 8),
  ('freight_rate_per_cbm', 8800),
  ('kg_per_cbm', 167)
ON CONFLICT (key) DO NOTHING;
