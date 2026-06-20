
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.spark_trade_group_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  oem_supplier_id UUID,
  oem_supplier_name TEXT,
  unit_cost_usd DECIMAL(10,2),
  retail_price_zar DECIMAL(10,2),
  minimum_investment DECIMAL(12,2) NOT NULL DEFAULT 50000,
  target_total_capital DECIMAL(12,2) NOT NULL DEFAULT 250000,
  current_total_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  target_investor_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  founder_user_id UUID NOT NULL,
  product_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spark_trade_group_brands TO anon;
GRANT SELECT, INSERT, UPDATE ON public.spark_trade_group_brands TO authenticated;
GRANT ALL ON public.spark_trade_group_brands TO service_role;

ALTER TABLE public.spark_trade_group_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View approved or own group brands"
ON public.spark_trade_group_brands FOR SELECT
USING (status <> 'pending_approval' OR founder_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Authenticated propose group brands"
ON public.spark_trade_group_brands FOR INSERT TO authenticated
WITH CHECK (founder_user_id = auth.uid());

CREATE POLICY "Founder or admin update group brand"
ON public.spark_trade_group_brands FOR UPDATE TO authenticated
USING (founder_user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (founder_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_group_brands_updated
BEFORE UPDATE ON public.spark_trade_group_brands
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();


CREATE TABLE public.spark_trade_group_brand_investors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_brand_id UUID NOT NULL REFERENCES public.spark_trade_group_brands(id) ON DELETE CASCADE,
  investor_user_id UUID NOT NULL,
  investment_amount DECIMAL(12,2) NOT NULL,
  ownership_stake DECIMAL(6,3) NOT NULL DEFAULT 0,
  payment_reference TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.spark_trade_group_brand_investors TO authenticated;
GRANT ALL ON public.spark_trade_group_brand_investors TO service_role;

ALTER TABLE public.spark_trade_group_brand_investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or co-investor records"
ON public.spark_trade_group_brand_investors FOR SELECT TO authenticated
USING (
  investor_user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.spark_trade_group_brands b WHERE b.id = group_brand_id AND b.founder_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.spark_trade_group_brand_investors me
    WHERE me.group_brand_id = spark_trade_group_brand_investors.group_brand_id
      AND me.investor_user_id = auth.uid()
      AND me.payment_status = 'verified'
  )
);

CREATE POLICY "Create own investment record"
ON public.spark_trade_group_brand_investors FOR INSERT TO authenticated
WITH CHECK (investor_user_id = auth.uid());

CREATE POLICY "Investor or admin update investment"
ON public.spark_trade_group_brand_investors FOR UPDATE TO authenticated
USING (investor_user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (investor_user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_group_brand_investors_updated
BEFORE UPDATE ON public.spark_trade_group_brand_investors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

CREATE INDEX idx_gb_investors_brand ON public.spark_trade_group_brand_investors(group_brand_id);
CREATE INDEX idx_gb_investors_user ON public.spark_trade_group_brand_investors(investor_user_id);

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spark_trade_income_path TEXT;
