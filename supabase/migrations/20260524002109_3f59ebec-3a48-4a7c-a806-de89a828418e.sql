
CREATE OR REPLACE FUNCTION public.compute_session_scores(_tier text)
 RETURNS TABLE(bid_id uuid, member_id uuid, full_name text, fiat_amount numeric, consistency_pct numeric, days_waiting integer, consistency_score numeric, time_waiting_score numeric, volume_score numeric, community_score numeric, bid_boost_score numeric, priority_score numeric, eligible boolean, override_type text, override_value numeric, breakdown jsonb)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  tier_min numeric; tier_pool_target numeric; max_days integer;
BEGIN
  SELECT min_entry, max_entry * COALESCE(daily_velocity_cap, 1)
    INTO tier_min, tier_pool_target
    FROM public.circle_tiers WHERE tier = _tier;
  IF tier_min IS NULL THEN tier_min := 0; tier_pool_target := 1; END IF;
  IF tier_pool_target IS NULL OR tier_pool_target = 0 THEN tier_pool_target := 1; END IF;

  SELECT GREATEST(1, COALESCE(MAX(EXTRACT(DAY FROM (now() - b.created_at))::int), 1))
    INTO max_days
    FROM public.circle_bids b
   WHERE b.tier = _tier AND b.status = 'vault' AND b.vault_start IS NOT NULL;

  RETURN QUERY
  WITH active_bids AS (
    SELECT b.* FROM public.circle_bids b
     WHERE b.tier = _tier AND b.status = 'vault' AND b.vault_start IS NOT NULL
  ),
  per_member AS (
    SELECT ab.id AS bid_id, ab.member_id AS mid, ab.fiat_amount AS amt, ab.created_at AS bid_created,
      (SELECT COUNT(*) FROM public.circle_bids x WHERE x.member_id = ab.member_id AND x.status IN ('vault','matched','paid'))::numeric AS made,
      (SELECT COUNT(*) FROM public.circle_bids x WHERE x.member_id = ab.member_id AND COALESCE(x.status,'pending') NOT IN ('rejected'))::numeric AS expected,
      EXTRACT(DAY FROM (now() - ab.created_at))::int AS dw,
      (SELECT COALESCE(SUM(x.fiat_amount),0) FROM public.circle_bids x WHERE x.member_id = ab.member_id AND x.tier = _tier AND x.status = 'vault')::numeric AS vol,
      (SELECT COUNT(*) FROM public.members m WHERE m.referred_by = ab.member_id)::numeric AS refs,
      (SELECT COUNT(DISTINCT date_trunc('day', x.created_at)) FROM public.circle_bids x WHERE x.member_id = ab.member_id)::numeric AS active_days,
      (SELECT COALESCE(kyc_level,0) FROM public.members m WHERE m.id = ab.member_id) AS kyc
    FROM active_bids ab
  ),
  scored AS (
    SELECT pm.bid_id, pm.mid, pm.amt, pm.dw,
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
    SELECT s.*, o.override_type AS otype, o.boost_value AS oval
    FROM scored s
    LEFT JOIN LATERAL (
      SELECT override_type, boost_value FROM public.circle_allocation_overrides
       WHERE bid_id = s.bid_id AND consumed = false
       ORDER BY created_at DESC LIMIT 1
    ) o ON true
  )
  SELECT w.bid_id, w.mid, COALESCE(m.full_name, 'Member'),
    w.amt, w.cons_pct, w.dw, w.s_cons, w.s_time, w.s_vol, w.s_comm, w.s_boost,
    (w.s_cons + w.s_time + w.s_vol + w.s_comm + w.s_boost + COALESCE(CASE WHEN w.otype='boost' THEN w.oval ELSE 0 END,0))::numeric AS total,
    (w.cons_pct >= 80 AND COALESCE(m.kyc_level,0) >= 2 AND COALESCE(w.otype,'') <> 'skip') AS eligible,
    w.otype, COALESCE(w.oval, 0),
    jsonb_build_object(
      'consistency_pct', w.cons_pct, 'days_waiting', w.dw, 'fiat_amount', w.amt,
      'referrals', w.refs, 'active_days', w.active_days, 'kyc_level', w.kyc,
      'parts', jsonb_build_object(
        'consistency', w.s_cons, 'time_waiting', w.s_time, 'volume', w.s_vol,
        'community', w.s_comm, 'bid_boost', w.s_boost,
        'admin_boost', COALESCE(CASE WHEN w.otype='boost' THEN w.oval ELSE 0 END, 0)
      ),
      'override', w.otype
    )
  FROM with_overrides w
  LEFT JOIN public.members m ON m.id = w.mid
  ORDER BY total DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_circle_queue_status()
RETURNS TABLE(
  bid_id uuid, tier text, fiat_amount numeric, payout_amount numeric, status text,
  created_at timestamptz, payment_confirmed_at timestamptz, payout_date timestamptz,
  vault_start timestamptz, vault_end timestamptz, effective_vault_end timestamptz,
  priority_score numeric, queue_position integer, total_active integer,
  days_remaining numeric, hours_remaining numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH latest_per_tier AS (
    SELECT DISTINCT ON (cb.tier)
      cb.id, cb.tier, cb.fiat_amount, cb.payout_amount, cb.status, cb.created_at,
      cb.payment_confirmed_at, cb.payout_date, cb.vault_start, cb.vault_end, cb.member_id,
      ct.vault_days,
      (
        COALESCE(NULLIF(m.consistency_score, 0), 40.0)
        + COALESCE(NULLIF(m.time_waiting_score, 0), 0)
        + COALESCE(NULLIF(m.contribution_volume_score, 0),
            CASE WHEN cb.fiat_amount >= 10000 THEN 10.0
                 WHEN cb.fiat_amount >= 5000  THEN 7.0
                 WHEN cb.fiat_amount >= 2000  THEN 5.0
                 WHEN cb.fiat_amount >= 500   THEN 3.0
                 ELSE 1.0 END)
        + COALESCE(NULLIF(m.community_score, 0), 10.0)
        + COALESCE(NULLIF(m.bid_boost_score, 0), 0)
      )::numeric AS calc_score
    FROM public.circle_bids cb
    LEFT JOIN public.circle_tiers ct ON ct.tier = cb.tier
    LEFT JOIN public.members m ON m.id = cb.member_id
    WHERE cb.member_id = auth.uid()
      AND cb.status IN ('vault', 'payment_pending', 'pending', 'paid')
    ORDER BY cb.tier,
      CASE cb.status WHEN 'vault' THEN 1 WHEN 'payment_pending' THEN 2 WHEN 'pending' THEN 3 WHEN 'paid' THEN 4 ELSE 5 END,
      cb.created_at DESC NULLS LAST
  ),
  enriched AS (
    SELECT l.*,
      COALESCE(l.vault_end,
        CASE WHEN l.status = 'vault' THEN
          COALESCE(l.payment_confirmed_at, l.vault_start, l.created_at) + (COALESCE(l.vault_days, 0) || ' days')::interval
        ELSE NULL END
      ) AS derived_vault_end
    FROM latest_per_tier l
  ),
  ranked AS (
    SELECT cb.id, cb.tier, cb.created_at,
      (
        COALESCE(NULLIF(m.consistency_score, 0), 40.0)
        + COALESCE(NULLIF(m.time_waiting_score, 0), 0)
        + COALESCE(NULLIF(m.contribution_volume_score, 0),
            CASE WHEN cb.fiat_amount >= 10000 THEN 10.0
                 WHEN cb.fiat_amount >= 5000  THEN 7.0
                 WHEN cb.fiat_amount >= 2000  THEN 5.0
                 WHEN cb.fiat_amount >= 500   THEN 3.0
                 ELSE 1.0 END)
        + COALESCE(NULLIF(m.community_score, 0), 10.0)
        + COALESCE(NULLIF(m.bid_boost_score, 0), 0)
      )::numeric AS calc_score
    FROM public.circle_bids cb
    LEFT JOIN public.members m ON m.id = cb.member_id
    WHERE cb.status = 'vault' AND cb.vault_start IS NOT NULL
  )
  SELECT e.id, e.tier, e.fiat_amount, e.payout_amount, e.status,
    e.created_at, e.payment_confirmed_at, e.payout_date, e.vault_start, e.vault_end,
    e.derived_vault_end,
    e.calc_score,
    CASE WHEN e.status = 'vault' AND e.vault_start IS NOT NULL THEN (
      SELECT (COUNT(*) + 1)::integer FROM ranked r
      WHERE r.tier = e.tier AND r.id <> e.id
        AND (r.calc_score > e.calc_score OR (r.calc_score = e.calc_score AND r.created_at < e.created_at))
    ) ELSE NULL END,
    (SELECT COUNT(*)::integer FROM ranked r WHERE r.tier = e.tier),
    CASE WHEN e.derived_vault_end IS NOT NULL THEN EXTRACT(EPOCH FROM (e.derived_vault_end - now())) / 86400 ELSE NULL END,
    CASE WHEN e.derived_vault_end IS NOT NULL THEN EXTRACT(EPOCH FROM (e.derived_vault_end - now())) / 3600 ELSE NULL END
  FROM enriched e;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_circle_queue_status() TO authenticated;
