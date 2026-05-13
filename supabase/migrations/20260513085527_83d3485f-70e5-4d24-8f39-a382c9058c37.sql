
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paystack_reference text;

ALTER TABLE public.reit_units
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paystack_reference text;

ALTER TABLE public.drive_members
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS payment_ref text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS buyers_club_payment_method text,
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code text,
  ADD COLUMN IF NOT EXISTS paystack_customer_code text,
  ADD COLUMN IF NOT EXISTS paystack_plan_code text;

CREATE TABLE IF NOT EXISTS public.paystack_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  reference text,
  member_id uuid,
  raw jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paystack_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paystack_events admin read" ON public.paystack_events;
CREATE POLICY "paystack_events admin read"
  ON public.paystack_events FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_paystack_events_ref ON public.paystack_events(reference);
CREATE INDEX IF NOT EXISTS idx_paystack_events_event ON public.paystack_events(event);

-- Lock down findings from prior scan that block live launch:
-- 1) bank_accounts public read → restrict to authenticated members
DROP POLICY IF EXISTS "bank_accounts public read" ON public.bank_accounts;
CREATE POLICY "bank_accounts auth read"
  ON public.bank_accounts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2) spark_trade_joins anon SELECT → require auth + scope to owner (admins via existing policies)
DROP POLICY IF EXISTS "spark_trade_joins public read" ON public.spark_trade_joins;
DROP POLICY IF EXISTS "spark_trade_joins read" ON public.spark_trade_joins;
DROP POLICY IF EXISTS "spark_trade_joins select" ON public.spark_trade_joins;
CREATE POLICY "spark_trade_joins owner read"
  ON public.spark_trade_joins FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));
