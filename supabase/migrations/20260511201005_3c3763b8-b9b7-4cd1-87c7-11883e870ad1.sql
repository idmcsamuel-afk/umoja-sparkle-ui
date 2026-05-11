
-- 1. Spark trade shortlist additions
ALTER TABLE public.spark_trade_shortlist
  ADD COLUMN IF NOT EXISTS estimated_monthly_sales integer,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2. Members buyers club access
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS has_buyers_club_access boolean NOT NULL DEFAULT false;

-- 3. Normalize manuel -> manual
UPDATE public.spark_trade_shortlist SET data_source = 'manual' WHERE data_source = 'manuel';

-- 4. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_member uuid,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. assign_referrer RPC
CREATE OR REPLACE FUNCTION public.assign_referrer(_member uuid, _referrer uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.members%ROWTYPE;
  m public.members%ROWTYPE;
  already_credited boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _member = _referrer THEN RAISE EXCEPTION 'self-referral not allowed'; END IF;

  SELECT * INTO m FROM public.members WHERE id = _member;
  SELECT * INTO ref FROM public.members WHERE id = _referrer;
  IF m.id IS NULL OR ref.id IS NULL THEN RAISE EXCEPTION 'member not found'; END IF;

  UPDATE public.members
     SET referred_by = _referrer,
         referred_by_code = ref.referral_code
   WHERE id = _member;

  SELECT EXISTS (
    SELECT 1 FROM public.spark_transactions
     WHERE from_member = _member AND to_member = _referrer
       AND tx_type = 'referral_signup'
  ) INTO already_credited;

  IF NOT already_credited THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    INSERT INTO public.spark_wallets (member_id, balance)
      VALUES (_referrer, 200)
      ON CONFLICT (member_id) DO UPDATE
        SET balance = public.spark_wallets.balance + 200,
            updated_at = now();
    PERFORM set_config('app.allow_wallet_write', 'off', true);

    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
      VALUES (_member, _referrer, 200, 'referral_signup', 'completed');

    INSERT INTO public.notifications (member_id, title, body, kind, link)
      VALUES (_referrer, 'You earned 200 Sparks ✨',
              COALESCE(m.full_name,'A member') || ' was assigned to you by an admin.',
              'referral', '/referrals');
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'assign_referrer', _member,
            jsonb_build_object('referrer_id', _referrer,
                               'referrer_code', ref.referral_code,
                               'credited', NOT already_credited));

  RETURN jsonb_build_object('ok', true, 'credited', NOT already_credited);
END $$;

-- 6. Seed demo products (idempotent)
INSERT INTO public.spark_trade_shortlist
  (asin, product_name, category, sale_price, cost_price, estimated_margin, margin_pct,
   data_source, status, target_slots, moq, is_demo, estimated_monthly_sales)
VALUES
  ('DEMO-001', 'Wireless Earbuds Pro (DEMO)', 'Electronics', 899, 420, 479, 53.28,
   'manual', 'open', 25, 5, true, 1800),
  ('DEMO-002', 'Smart Air Fryer 6L (DEMO)', 'Kitchen', 1499, 780, 719, 47.97,
   'manual', 'open', 25, 5, true, 1200),
  ('DEMO-003', 'LED Ring Light Kit (DEMO)', 'Beauty', 549, 220, 329, 59.93,
   'manual', 'open', 25, 5, true, 2400)
ON CONFLICT (asin) DO NOTHING;
