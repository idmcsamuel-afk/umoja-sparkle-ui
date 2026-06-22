CREATE OR REPLACE FUNCTION public.admin_adjust_sparks(_member uuid, _delta numeric, _reason text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_balance numeric;
  cur_purchased numeric;
  cur_earned numeric;
  cur_promo numeric;
  take_from_promo numeric := 0;
  take_from_earned numeric := 0;
  take_from_purchased numeric := 0;
  remaining numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason required'; END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);

  -- Ensure wallet row exists
  INSERT INTO public.spark_wallets (member_id, purchased_balance)
    VALUES (_member, GREATEST(0, _delta))
    ON CONFLICT (member_id) DO NOTHING;

  IF _delta > 0 THEN
    -- Credit goes to purchased_balance (no expiry, admin-controlled)
    UPDATE public.spark_wallets
      SET purchased_balance = COALESCE(purchased_balance,0) + _delta,
          updated_at = now()
      WHERE member_id = _member
      RETURNING balance INTO new_balance;
  ELSE
    -- Debit: drain promo first, then earned, then purchased
    SELECT COALESCE(promotional_balance,0), COALESCE(earned_balance,0), COALESCE(purchased_balance,0)
      INTO cur_promo, cur_earned, cur_purchased
      FROM public.spark_wallets WHERE member_id = _member;

    remaining := abs(_delta);
    take_from_promo := LEAST(cur_promo, remaining);
    remaining := remaining - take_from_promo;
    take_from_earned := LEAST(cur_earned, remaining);
    remaining := remaining - take_from_earned;
    take_from_purchased := LEAST(cur_purchased, remaining);

    UPDATE public.spark_wallets
      SET promotional_balance = COALESCE(promotional_balance,0) - take_from_promo,
          earned_balance      = COALESCE(earned_balance,0)      - take_from_earned,
          purchased_balance   = COALESCE(purchased_balance,0)   - take_from_purchased,
          updated_at = now()
      WHERE member_id = _member
      RETURNING balance INTO new_balance;
  END IF;

  PERFORM set_config('app.allow_wallet_write', 'off', true);

  IF _delta > 0 THEN
    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
      VALUES (NULL, _member, _delta, 'admin_adjustment', 'completed', _reason);
  ELSE
    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
      VALUES (_member, NULL, abs(_delta), 'admin_adjustment', 'completed', _reason);
  END IF;

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
END $function$;

-- Backfill the +300 that silently failed for Sonnyboy Simon Mojake
DO $$
BEGIN
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  UPDATE public.spark_wallets
    SET purchased_balance = COALESCE(purchased_balance,0) + 300,
        updated_at = now()
    WHERE member_id = 'f78da433-8f7b-4585-9512-f52112e3afa4';
  PERFORM set_config('app.allow_wallet_write', 'off', true);
END $$;