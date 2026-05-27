
ALTER TABLE public.spark_wallets
  ADD COLUMN IF NOT EXISTS promotional_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_expires_at timestamptz;

UPDATE public.spark_wallets
   SET promotional_balance = balance,
       promo_expires_at = COALESCE(promo_expires_at, now() + interval '30 days')
 WHERE promotional_balance = 0 AND earned_balance = 0 AND purchased_balance = 0 AND balance > 0;

CREATE TABLE IF NOT EXISTS public.spark_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  tier text NOT NULL,
  amount_paid numeric NOT NULL,
  sparks_added integer NOT NULL,
  bonus_sparks integer NOT NULL DEFAULT 0,
  payment_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.spark_purchases TO authenticated;
GRANT ALL ON public.spark_purchases TO service_role;

ALTER TABLE public.spark_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own spark purchases" ON public.spark_purchases;
CREATE POLICY "Members view own spark purchases"
  ON public.spark_purchases FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Members create own spark purchase" ON public.spark_purchases;
CREATE POLICY "Members create own spark purchase"
  ON public.spark_purchases FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_spark_purchases_member ON public.spark_purchases(member_id);
CREATE INDEX IF NOT EXISTS idx_spark_purchases_ref ON public.spark_purchases(payment_reference);

CREATE TABLE IF NOT EXISTS public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  spark_type text NOT NULL CHECK (spark_type IN ('promotional','earned','purchased')),
  bet_amount numeric NOT NULL,
  won_amount numeric NOT NULL DEFAULT 0,
  outcome text NOT NULL CHECK (outcome IN ('win','lose')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own game results" ON public.game_results;
CREATE POLICY "Members view own game results"
  ON public.game_results FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_game_results_member ON public.game_results(member_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_spark_purchase(
  _member uuid, _sparks integer, _bonus integer, _amount_paid numeric,
  _reference text, _email text, _phone text, _tier text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_add integer := _sparks + COALESCE(_bonus,0);
  new_purchased numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _member <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF total_add <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  IF EXISTS (SELECT 1 FROM public.spark_purchases WHERE payment_reference = _reference AND status = 'completed') THEN
    SELECT purchased_balance INTO new_purchased FROM public.spark_wallets WHERE member_id = _member;
    RETURN jsonb_build_object('ok', true, 'already_applied', true, 'purchased_balance', new_purchased);
  END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance, purchased_balance)
    VALUES (_member, total_add, total_add)
    ON CONFLICT (member_id) DO UPDATE
      SET purchased_balance = public.spark_wallets.purchased_balance + total_add,
          balance = public.spark_wallets.balance + total_add,
          updated_at = now()
    RETURNING purchased_balance INTO new_purchased;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_purchases (member_id, email, phone, tier, amount_paid, sparks_added, bonus_sparks, payment_reference, status)
    VALUES (_member, _email, _phone, _tier, _amount_paid, _sparks, COALESCE(_bonus,0), _reference, 'completed')
    ON CONFLICT (payment_reference) DO UPDATE SET status = 'completed';

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Sparks added ✨', '+' || total_add || ' Sparks credited to your wallet.', 'sparks', '/spark-pit');

  RETURN jsonb_build_object('ok', true, 'purchased_balance', new_purchased, 'added', total_add);
END $$;

CREATE OR REPLACE FUNCTION public.apply_spark_flip_outcome(
  _spark_type text, _bet numeric, _choice text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  w public.spark_wallets%ROWTYPE;
  win_prob numeric;
  won boolean;
  result text;
  payout numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _spark_type NOT IN ('promotional','earned','purchased') THEN RAISE EXCEPTION 'invalid spark_type'; END IF;
  IF _bet <= 0 THEN RAISE EXCEPTION 'invalid bet'; END IF;
  IF _choice NOT IN ('heads','tails') THEN RAISE EXCEPTION 'invalid choice'; END IF;

  SELECT * INTO w FROM public.spark_wallets WHERE member_id = uid FOR UPDATE;
  IF w.member_id IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;

  IF _spark_type = 'promotional' AND w.promotional_balance < _bet THEN RAISE EXCEPTION 'insufficient promotional sparks'; END IF;
  IF _spark_type = 'earned' AND w.earned_balance < _bet THEN RAISE EXCEPTION 'insufficient earned sparks'; END IF;
  IF _spark_type = 'purchased' AND w.purchased_balance < _bet THEN RAISE EXCEPTION 'insufficient purchased sparks'; END IF;

  IF _spark_type = 'promotional' AND w.promo_expires_at IS NOT NULL AND w.promo_expires_at < now() THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    UPDATE public.spark_wallets SET promotional_balance = 0,
      balance = GREATEST(0, balance - w.promotional_balance), updated_at = now()
      WHERE member_id = uid;
    PERFORM set_config('app.allow_wallet_write', 'off', true);
    RAISE EXCEPTION 'promotional sparks expired';
  END IF;

  win_prob := CASE WHEN _spark_type = 'promotional' THEN 0.30 ELSE 0.45 END;
  won := random() < win_prob;
  result := CASE WHEN won THEN _choice ELSE (CASE WHEN _choice = 'heads' THEN 'tails' ELSE 'heads' END) END;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  IF won THEN
    payout := _bet * 2;
    UPDATE public.spark_wallets
       SET promotional_balance = promotional_balance - CASE WHEN _spark_type='promotional' THEN _bet ELSE 0 END,
           earned_balance = earned_balance - CASE WHEN _spark_type='earned' THEN _bet ELSE 0 END + payout,
           purchased_balance = purchased_balance - CASE WHEN _spark_type='purchased' THEN _bet ELSE 0 END,
           balance = balance - _bet + payout,
           updated_at = now()
     WHERE member_id = uid;
  ELSE
    UPDATE public.spark_wallets
       SET promotional_balance = promotional_balance - CASE WHEN _spark_type='promotional' THEN _bet ELSE 0 END,
           earned_balance = earned_balance - CASE WHEN _spark_type='earned' THEN _bet ELSE 0 END,
           purchased_balance = purchased_balance - CASE WHEN _spark_type='purchased' THEN _bet ELSE 0 END,
           balance = balance - _bet,
           updated_at = now()
     WHERE member_id = uid;
  END IF;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.game_results (member_id, game_type, spark_type, bet_amount, won_amount, outcome)
    VALUES (uid, 'spark_flip', _spark_type, _bet, payout, CASE WHEN won THEN 'win' ELSE 'lose' END);

  INSERT INTO public.spark_flip_games (member_id, choice, result, payout, bet_sparks)
    VALUES (uid, _choice, result, payout, _bet);

  RETURN jsonb_build_object('ok', true, 'won', won, 'result', result, 'payout', payout, 'win_prob', win_prob);
END $$;

CREATE OR REPLACE FUNCTION public.spark_balance_breakdown(_member uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid := COALESCE(_member, auth.uid());
  w public.spark_wallets%ROWTYPE;
  total numeric;
  withdrawable numeric;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _member IS NOT NULL AND _member <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO w FROM public.spark_wallets WHERE member_id = target;
  IF w.member_id IS NULL THEN
    RETURN jsonb_build_object('promotional',0,'earned',0,'purchased',0,'total',0,'withdrawable',0,'promo_expires_at',null,'zar_value',0);
  END IF;

  total := COALESCE(w.promotional_balance,0) + COALESCE(w.earned_balance,0) + COALESCE(w.purchased_balance,0);
  withdrawable := COALESCE(w.earned_balance,0) + COALESCE(w.purchased_balance,0);

  RETURN jsonb_build_object(
    'promotional', COALESCE(w.promotional_balance,0),
    'earned', COALESCE(w.earned_balance,0),
    'purchased', COALESCE(w.purchased_balance,0),
    'total', total,
    'withdrawable', withdrawable,
    'promo_expires_at', w.promo_expires_at,
    'zar_value', ROUND(total * 1.40, 2)
  );
END $$;
