
-- ============ circle_bids new columns ============
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS boost_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sparks_spent_on_boosts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_boost_at timestamptz;

-- ============ circle_boosts table ============
CREATE TABLE IF NOT EXISTS public.circle_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.circle_bids(id) ON DELETE CASCADE,
  boost_number integer NOT NULL CHECK (boost_number BETWEEN 1 AND 3),
  sparks_cost integer NOT NULL DEFAULT 50,
  priority_boost_amount integer NOT NULL DEFAULT 10,
  position_before integer,
  position_after integer,
  old_priority_score numeric,
  new_priority_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_circle_boosts_member ON public.circle_boosts(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_boosts_bid ON public.circle_boosts(bid_id);

GRANT SELECT ON public.circle_boosts TO authenticated;
GRANT ALL ON public.circle_boosts TO service_role;

ALTER TABLE public.circle_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own boosts"
  ON public.circle_boosts FOR SELECT TO authenticated
  USING (member_id = auth.uid());

-- ============ free_spark_claims table ============
CREATE TABLE IF NOT EXISTS public.free_spark_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  claim_type text NOT NULL,
  sparks_awarded integer NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  expires_at timestamptz,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_free_spark_one_time
  ON public.free_spark_claims(member_id, claim_type)
  WHERE claim_type IN ('signup_bonus','daily_3','daily_7','daily_30');
CREATE INDEX IF NOT EXISTS idx_free_spark_claims_member
  ON public.free_spark_claims(member_id, claimed_at DESC);

GRANT SELECT ON public.free_spark_claims TO authenticated;
GRANT ALL ON public.free_spark_claims TO service_role;

ALTER TABLE public.free_spark_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own claims"
  ON public.free_spark_claims FOR SELECT TO authenticated
  USING (member_id = auth.uid());

-- ============ boost_circle_bid RPC ============
CREATE OR REPLACE FUNCTION public.boost_circle_bid(_bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := auth.uid();
  v_bid public.circle_bids%ROWTYPE;
  v_wallet public.spark_wallets%ROWTYPE;
  v_cost integer := 50;
  v_priority_add integer := 10;
  v_total_sparks integer;
  v_pos_before integer;
  v_pos_after integer;
  v_old_score numeric;
  v_new_score numeric;
  v_boost_no integer;
  v_promo integer := 0;
  v_earned integer := 0;
  v_purchased integer := 0;
  v_remaining integer;
BEGIN
  IF v_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_bid FROM public.circle_bids
    WHERE id = _bid_id AND member_id = v_member
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bid_not_found');
  END IF;
  IF v_bid.status NOT IN ('active','vault','matched') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bid_not_active');
  END IF;
  IF v_bid.boost_count >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_boosts_used');
  END IF;
  IF v_bid.last_boost_at IS NOT NULL AND v_bid.last_boost_at > now() - interval '24 hours' THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'cooldown',
      'next_available', v_bid.last_boost_at + interval '24 hours'
    );
  END IF;

  -- Current position within tier (rank by priority_score desc, then created_at asc)
  SELECT rnk INTO v_pos_before FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(priority_score,0) DESC, created_at ASC) AS rnk
    FROM public.circle_bids
    WHERE tier = v_bid.tier AND status IN ('active','vault','matched')
  ) q WHERE id = v_bid.id;

  IF v_pos_before = 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_first');
  END IF;

  -- Wallet
  SELECT * INTO v_wallet FROM public.spark_wallets WHERE member_id = v_member FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_wallet');
  END IF;
  v_promo := CASE WHEN v_wallet.promo_expires_at IS NULL OR v_wallet.promo_expires_at > now()
                  THEN COALESCE(v_wallet.promotional_balance,0) ELSE 0 END;
  v_earned := COALESCE(v_wallet.earned_balance,0);
  v_purchased := COALESCE(v_wallet.purchased_balance,0);
  v_total_sparks := v_promo + v_earned + v_purchased;
  IF v_total_sparks < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_sparks', 'available', v_total_sparks);
  END IF;

  -- Deduct earned → purchased → promotional
  v_remaining := v_cost;
  IF v_earned > 0 THEN
    IF v_earned >= v_remaining THEN v_earned := v_earned - v_remaining; v_remaining := 0;
    ELSE v_remaining := v_remaining - v_earned; v_earned := 0; END IF;
  END IF;
  IF v_remaining > 0 AND v_purchased > 0 THEN
    IF v_purchased >= v_remaining THEN v_purchased := v_purchased - v_remaining; v_remaining := 0;
    ELSE v_remaining := v_remaining - v_purchased; v_purchased := 0; END IF;
  END IF;
  IF v_remaining > 0 AND v_promo > 0 THEN
    IF v_promo >= v_remaining THEN v_promo := v_promo - v_remaining; v_remaining := 0;
    ELSE v_remaining := v_remaining - v_promo; v_promo := 0; END IF;
  END IF;

  UPDATE public.spark_wallets
    SET earned_balance = v_earned,
        purchased_balance = v_purchased,
        promotional_balance = v_promo,
        updated_at = now()
    WHERE member_id = v_member;

  v_old_score := COALESCE(v_bid.priority_score, 0);
  v_new_score := v_old_score + v_priority_add;
  v_boost_no := v_bid.boost_count + 1;

  UPDATE public.circle_bids
    SET priority_score = v_new_score,
        boost_count = v_boost_no,
        total_sparks_spent_on_boosts = COALESCE(total_sparks_spent_on_boosts,0) + v_cost,
        last_boost_at = now(),
        updated_at = now()
    WHERE id = _bid_id;

  -- Recompute position after
  SELECT rnk INTO v_pos_after FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(priority_score,0) DESC, created_at ASC) AS rnk
    FROM public.circle_bids
    WHERE tier = v_bid.tier AND status IN ('active','vault','matched')
  ) q WHERE id = v_bid.id;

  INSERT INTO public.circle_boosts(
    member_id, bid_id, boost_number, sparks_cost, priority_boost_amount,
    position_before, position_after, old_priority_score, new_priority_score
  ) VALUES (
    v_member, _bid_id, v_boost_no, v_cost, v_priority_add,
    v_pos_before, v_pos_after, v_old_score, v_new_score
  );

  RETURN jsonb_build_object(
    'ok', true,
    'boost_number', v_boost_no,
    'boosts_remaining', 3 - v_boost_no,
    'position_before', v_pos_before,
    'position_after', v_pos_after,
    'sparks_spent', v_cost,
    'new_priority_score', v_new_score,
    'next_available', now() + interval '24 hours'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.boost_circle_bid(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.boost_circle_bid(uuid) TO authenticated;

-- ============ claim_free_sparks RPC ============
CREATE OR REPLACE FUNCTION public.claim_free_sparks(_claim_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := auth.uid();
  v_amount integer;
  v_expires timestamptz := now() + interval '30 days';
  v_exists boolean;
  v_last timestamptz;
BEGIN
  IF v_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  v_amount := CASE _claim_type
    WHEN 'signup_bonus' THEN 50
    WHEN 'daily_3' THEN 10
    WHEN 'daily_7' THEN 15
    WHEN 'daily_30' THEN 50
    WHEN 'streak_5' THEN 25
    ELSE NULL END;
  IF v_amount IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim_type');
  END IF;

  IF _claim_type IN ('signup_bonus','daily_3','daily_7','daily_30') THEN
    SELECT EXISTS(SELECT 1 FROM public.free_spark_claims
      WHERE member_id = v_member AND claim_type = _claim_type) INTO v_exists;
    IF v_exists THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
    END IF;
  ELSIF _claim_type = 'streak_5' THEN
    SELECT MAX(claimed_at) INTO v_last FROM public.free_spark_claims
      WHERE member_id = v_member AND claim_type = 'streak_5';
    IF v_last IS NOT NULL AND v_last > now() - interval '24 hours' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cooldown');
    END IF;
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.spark_wallets(member_id, promotional_balance, promo_expires_at)
    VALUES (v_member, 0, v_expires)
    ON CONFLICT (member_id) DO NOTHING;

  UPDATE public.spark_wallets
    SET promotional_balance = COALESCE(promotional_balance,0) + v_amount,
        promo_expires_at = GREATEST(COALESCE(promo_expires_at, v_expires), v_expires),
        updated_at = now()
    WHERE member_id = v_member;

  INSERT INTO public.free_spark_claims(member_id, claim_type, sparks_awarded, expires_at)
    VALUES (v_member, _claim_type, v_amount, v_expires);

  RETURN jsonb_build_object('ok', true, 'sparks_awarded', v_amount, 'expires_at', v_expires);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_sparks(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_free_sparks(text) TO authenticated;
