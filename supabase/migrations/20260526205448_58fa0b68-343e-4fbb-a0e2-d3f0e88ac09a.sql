CREATE TABLE public.spark_trade_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('basic','pro','fulfilled')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly','annual')),
  amount_paid NUMERIC NOT NULL,
  payment_reference TEXT UNIQUE,
  payment_date TIMESTAMPTZ DEFAULT now(),
  access_start_date DATE NOT NULL DEFAULT (now()::date),
  access_end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.spark_trade_subscriptions TO authenticated;
GRANT INSERT ON public.spark_trade_subscriptions TO anon;
GRANT ALL ON public.spark_trade_subscriptions TO service_role;

ALTER TABLE public.spark_trade_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own spark trade subs"
ON public.spark_trade_subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Anyone can create spark trade sub"
ON public.spark_trade_subscriptions FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins update spark trade subs"
ON public.spark_trade_subscriptions FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_spark_trade_subs_email ON public.spark_trade_subscriptions(email);
CREATE INDEX idx_spark_trade_subs_user ON public.spark_trade_subscriptions(user_id);