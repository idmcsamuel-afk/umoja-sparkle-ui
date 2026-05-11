
-- 1. Update tx_type constraint to allow both legacy and new types
ALTER TABLE public.spark_transactions DROP CONSTRAINT IF EXISTS spark_transactions_tx_type_check;
ALTER TABLE public.spark_transactions ADD CONSTRAINT spark_transactions_tx_type_check
CHECK (tx_type IN (
  'referral_bonus','signup_bonus','circle_contribution','circle_payout',
  'spark_trade_join','spark_exchange_buy','spark_exchange_sell',
  'game_entry','game_win','admin_adjustment','manual_credit',
  -- legacy values still in production data
  'referral_signup','referral_kyc_bonus','referral_admin_bonus'
));

-- 2. Add description column
ALTER TABLE public.spark_transactions ADD COLUMN IF NOT EXISTS description text;

-- 3. Admin RPC: adjust sparks with audit trail in spark_transactions
CREATE OR REPLACE FUNCTION public.admin_adjust_sparks(_member uuid, _delta numeric, _reason text)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason required'; END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (_member, GREATEST(0, _delta))
    ON CONFLICT (member_id) DO UPDATE
      SET balance = GREATEST(0, public.spark_wallets.balance + _delta),
          updated_at = now()
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
    VALUES (NULL, _member, _delta, 'admin_adjustment', 'completed', _reason);

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'adjust_sparks', _member,
            jsonb_build_object('delta', _delta, 'reason', _reason, 'new_balance', new_balance));

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member,
            CASE WHEN _delta > 0 THEN 'Sparks added ✨' ELSE 'Sparks adjusted' END,
            CASE WHEN _delta > 0
                 THEN '+' || _delta || ' Sparks: ' || _reason
                 ELSE _delta || ' Sparks: ' || _reason END,
            'admin', '/dashboard');

  RETURN new_balance;
END $$;

-- 4. RPC to fetch a member's transaction log (admin)
CREATE OR REPLACE FUNCTION public.admin_member_transactions(_member uuid, _limit integer DEFAULT 50)
RETURNS TABLE(id uuid, created_at timestamptz, amount numeric, tx_type text, status text, description text, from_member uuid, to_member uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, created_at, amount, tx_type, status, description, from_member, to_member
    FROM public.spark_transactions
   WHERE (from_member = _member OR to_member = _member)
     AND public.is_admin(auth.uid())
   ORDER BY created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 200));
$$;
