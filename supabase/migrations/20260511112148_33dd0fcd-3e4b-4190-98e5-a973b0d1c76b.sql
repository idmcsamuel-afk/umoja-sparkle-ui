
-- 1. Score columns on members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS priority_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_waiting_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribution_volume_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS community_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bid_boost_score numeric NOT NULL DEFAULT 0;

-- 2. Score columns on circle_bids
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS priority_score numeric,
  ADD COLUMN IF NOT EXISTS consistency_percentage numeric,
  ADD COLUMN IF NOT EXISTS days_waiting integer,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS payout_rank integer,
  ADD COLUMN IF NOT EXISTS allocated_at timestamptz;

-- 3. Payout-per-session config on platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payouts_seed integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS payouts_growth integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payouts_harvest integer NOT NULL DEFAULT 1;

-- 4. Allocation history
CREATE TABLE IF NOT EXISTS public.circle_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  session_at timestamptz NOT NULL DEFAULT now(),
  pool_total numeric NOT NULL DEFAULT 0,
  winners_count integer NOT NULL DEFAULT 0,
  payout_per_winner numeric NOT NULL DEFAULT 0,
  breakdown jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.circle_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alloc_select_auth" ON public.circle_allocations;
CREATE POLICY "alloc_select_auth"
  ON public.circle_allocations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "alloc_admin_insert" ON public.circle_allocations;
CREATE POLICY "alloc_admin_insert"
  ON public.circle_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Admin overrides (boost / skip) per bid per session
CREATE TABLE IF NOT EXISTS public.circle_allocation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL,
  tier text NOT NULL,
  override_type text NOT NULL CHECK (override_type IN ('boost','skip')),
  boost_value numeric NOT NULL DEFAULT 0,
  reason text,
  applied_to_allocation uuid,
  consumed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.circle_allocation_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overrides_admin_all" ON public.circle_allocation_overrides;
CREATE POLICY "overrides_admin_all"
  ON public.circle_allocation_overrides FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Scoring function
CREATE OR REPLACE FUNCTION public.compute_session_scores(_tier text)
RETURNS TABLE (
  bid_id uuid,
  member_id uuid,
  full_name text,
  fiat_amount numeric,
  consistency_pct numeric,
  days_waiting integer,
  consistency_score numeric,
  time_waiting_score numeric,
  volume_score numeric,
  community_score numeric,
  bid_boost_score numeric,
  priority_score numeric,
  eligible boolean,
  override_type text,
  override_value numeric,
  breakdown jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_min numeric;
  tier_pool_target numeric;
  max_days integer;
BEGIN
  SELECT min_entry, max_entry * COALESCE(daily_velocity_cap, 1)
    INTO tier_min, tier_pool_target
    FROM public.circle_tiers WHERE tier = _tier;
  IF tier_min IS NULL THEN
    tier_min := 0; tier_pool_target := 1;
  END IF;
  IF tier_pool_target IS NULL OR tier_pool_target = 0 THEN
    tier_pool_target := 1;
  END IF;

  -- max waiting days across active bids in this tier (for normalisation)
  SELECT GREATEST(1, COALESCE(MAX(EXTRACT(DAY FROM (now() - b.created_at))::int), 1))
    INTO max_days
    FROM public.circle_bids b
   WHERE b.tier = _tier AND b.status = 'active';

  RETURN QUERY
  WITH active_bids AS (
    SELECT b.*
      FROM public.circle_bids b
     WHERE b.tier = _tier AND b.status = 'active'
  ),
  per_member AS (
    SELECT
      ab.id          AS bid_id,
      ab.member_id   AS mid,
      ab.fiat_amount AS amt,
      ab.created_at  AS bid_created,
      -- consistency = confirmed-or-matched bids / non-rejected total bids by this member (across all tiers)
      (SELECT COUNT(*) FROM public.circle_bids x
        WHERE x.member_id = ab.member_id
          AND x.status IN ('active','matched'))::numeric AS made,
      (SELECT COUNT(*) FROM public.circle_bids x
        WHERE x.member_id = ab.member_id
          AND COALESCE(x.status,'pending') NOT IN ('rejected'))::numeric AS expected,
      EXTRACT(DAY FROM (now() - ab.created_at))::int AS dw,
      -- volume = sum of this member's active bids in this tier
      (SELECT COALESCE(SUM(x.fiat_amount),0) FROM public.circle_bids x
        WHERE x.member_id = ab.member_id AND x.tier = _tier AND x.status = 'active')::numeric AS vol,
      -- referrals
      (SELECT COUNT(*) FROM public.members m WHERE m.referred_by = ab.member_id)::numeric AS refs,
      -- active days = distinct days this member has placed a bid
      (SELECT COUNT(DISTINCT date_trunc('day', x.created_at)) FROM public.circle_bids x
        WHERE x.member_id = ab.member_id)::numeric AS active_days,
      (SELECT COALESCE(kyc_level,0) FROM public.members m WHERE m.id = ab.member_id) AS kyc
      FROM active_bids ab
  ),
  scored AS (
    SELECT
      pm.bid_id,
      pm.mid,
      pm.amt,
      pm.dw,
      CASE WHEN pm.expected > 0 THEN ROUND((pm.made / pm.expected) * 100, 2) ELSE 100 END AS cons_pct,
      CASE WHEN pm.expected > 0 THEN LEAST(40, (pm.made / pm.expected) * 40) ELSE 40 END AS s_cons,
      LEAST(30, (pm.dw::numeric / NULLIF(max_days,0)) * 30) AS s_time,
      LEAST(15, (pm.vol / tier_pool_target) * 15) AS s_vol,
      LEAST(10, (pm.refs * 2) + (pm.active_days * 0.1) + CASE WHEN pm.kyc >= 3 THEN 2 ELSE 0 END) AS s_comm,
      CASE WHEN tier_min > 0 THEN LEAST(5, GREATEST(0, ((pm.amt - tier_min) / tier_min) * 5)) ELSE 0 END AS s_boost,
      pm.refs, pm.active_days, pm.kyc
    FROM per_member pm
  ),
  with_overrides AS (
    SELECT
      s.*,
      o.override_type AS otype,
      o.boost_value   AS oval
    FROM scored s
    LEFT JOIN LATERAL (
      SELECT override_type, boost_value
        FROM public.circle_allocation_overrides
       WHERE bid_id = s.bid_id AND consumed = false
       ORDER BY created_at DESC LIMIT 1
    ) o ON true
  )
  SELECT
    w.bid_id,
    w.mid,
    COALESCE(m.full_name, 'Member'),
    w.amt,
    w.cons_pct,
    w.dw,
    w.s_cons,
    w.s_time,
    w.s_vol,
    w.s_comm,
    w.s_boost,
    (w.s_cons + w.s_time + w.s_vol + w.s_comm + w.s_boost + COALESCE(CASE WHEN w.otype='boost' THEN w.oval ELSE 0 END,0))::numeric AS total,
    (w.cons_pct >= 80 AND COALESCE(m.kyc_level,0) >= 2 AND COALESCE(w.otype,'') <> 'skip') AS eligible,
    w.otype,
    COALESCE(w.oval, 0),
    jsonb_build_object(
      'consistency_pct', w.cons_pct,
      'days_waiting', w.dw,
      'fiat_amount', w.amt,
      'referrals', w.refs,
      'active_days', w.active_days,
      'kyc_level', w.kyc,
      'parts', jsonb_build_object(
        'consistency', w.s_cons,
        'time_waiting', w.s_time,
        'volume', w.s_vol,
        'community', w.s_comm,
        'bid_boost', w.s_boost,
        'admin_boost', COALESCE(CASE WHEN w.otype='boost' THEN w.oval ELSE 0 END, 0)
      ),
      'override', w.otype
    )
  FROM with_overrides w
  LEFT JOIN public.members m ON m.id = w.mid
  ORDER BY total DESC;
END $$;

REVOKE EXECUTE ON FUNCTION public.compute_session_scores(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_session_scores(text) TO authenticated;

-- 7. Apply allocation (admin-only)
CREATE OR REPLACE FUNCTION public.apply_allocation(
  _tier text,
  _winner_bid_ids uuid[],
  _pool_total numeric,
  _breakdown jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alloc_id uuid;
  per_winner numeric;
  cnt int;
  i int := 0;
  bid_id uuid;
  rec record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  cnt := COALESCE(array_length(_winner_bid_ids, 1), 0);
  IF cnt = 0 THEN RAISE EXCEPTION 'no winners provided'; END IF;
  per_winner := ROUND(_pool_total / cnt, 2);

  INSERT INTO public.circle_allocations (tier, pool_total, winners_count, payout_per_winner, breakdown, created_by)
    VALUES (_tier, _pool_total, cnt, per_winner, _breakdown, auth.uid())
    RETURNING id INTO alloc_id;

  FOREACH bid_id IN ARRAY _winner_bid_ids LOOP
    i := i + 1;
    UPDATE public.circle_bids
       SET status = 'matched',
           payout_rank = i,
           payout_amount = per_winner,
           allocated_at = now(),
           score_breakdown = COALESCE(_breakdown -> bid_id::text, score_breakdown)
     WHERE id = bid_id AND tier = _tier
     RETURNING member_id INTO rec;

    IF rec.member_id IS NOT NULL THEN
      INSERT INTO public.notifications (member_id, title, body, kind, link)
        VALUES (rec.member_id,
                '🎉 You won a ' || _tier || ' payout',
                'Rank #' || i || ' · payout R' || per_winner,
                'allocation', '/circle');
    END IF;
  END LOOP;

  -- Mark any overrides for this tier as consumed
  UPDATE public.circle_allocation_overrides
     SET consumed = true, applied_to_allocation = alloc_id
   WHERE tier = _tier AND consumed = false;

  RETURN alloc_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_allocation(text, uuid[], numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_allocation(text, uuid[], numeric, jsonb) TO authenticated;
