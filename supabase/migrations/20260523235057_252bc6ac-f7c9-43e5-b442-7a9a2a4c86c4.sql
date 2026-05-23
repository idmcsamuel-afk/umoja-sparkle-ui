CREATE OR REPLACE FUNCTION public.circle_tier_stats()
RETURNS TABLE(tier text, pool numeric, members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cb.tier,
         COALESCE(SUM(cb.fiat_amount), 0)::numeric AS pool,
         COUNT(*)::bigint AS members
    FROM public.circle_bids cb
   WHERE cb.status = 'vault'
     AND cb.vault_start IS NOT NULL
   GROUP BY cb.tier;
$$;

GRANT EXECUTE ON FUNCTION public.circle_tier_stats() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_circle_queue_status()
RETURNS TABLE(
  bid_id uuid,
  tier text,
  fiat_amount numeric,
  payout_amount numeric,
  status text,
  created_at timestamptz,
  payment_confirmed_at timestamptz,
  payout_date timestamptz,
  vault_start timestamptz,
  vault_end timestamptz,
  effective_vault_end timestamptz,
  priority_score numeric,
  queue_position integer,
  total_active integer,
  days_remaining numeric,
  hours_remaining numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_per_tier AS (
    SELECT DISTINCT ON (cb.tier)
      cb.id,
      cb.tier,
      cb.fiat_amount,
      cb.payout_amount,
      cb.status,
      cb.created_at,
      cb.payment_confirmed_at,
      cb.payout_date,
      cb.vault_start,
      cb.vault_end,
      cb.member_id,
      ct.vault_days,
      COALESCE(m.priority_score, cb.priority_score, 0)::numeric AS member_priority_score
    FROM public.circle_bids cb
    LEFT JOIN public.circle_tiers ct ON ct.tier = cb.tier
    LEFT JOIN public.members m ON m.id = cb.member_id
    WHERE cb.member_id = auth.uid()
      AND cb.status IN ('vault', 'payment_pending', 'pending', 'paid')
    ORDER BY cb.tier,
      CASE cb.status
        WHEN 'vault' THEN 1
        WHEN 'payment_pending' THEN 2
        WHEN 'pending' THEN 3
        WHEN 'paid' THEN 4
        ELSE 5
      END,
      cb.created_at DESC NULLS LAST
  ),
  enriched AS (
    SELECT
      l.*,
      COALESCE(
        l.vault_end,
        CASE
          WHEN l.status = 'vault' THEN
            COALESCE(l.payment_confirmed_at, l.vault_start, l.created_at) + (COALESCE(l.vault_days, 0) || ' days')::interval
          ELSE NULL
        END
      ) AS derived_vault_end
    FROM latest_per_tier l
  )
  SELECT
    e.id AS bid_id,
    e.tier,
    e.fiat_amount,
    e.payout_amount,
    e.status,
    e.created_at,
    e.payment_confirmed_at,
    e.payout_date,
    e.vault_start,
    e.vault_end,
    e.derived_vault_end AS effective_vault_end,
    e.member_priority_score AS priority_score,
    CASE
      WHEN e.status = 'vault' AND e.vault_start IS NOT NULL THEN (
        SELECT (COUNT(*) + 1)::integer
        FROM public.circle_bids cb2
        LEFT JOIN public.members m2 ON m2.id = cb2.member_id
        WHERE cb2.tier = e.tier
          AND cb2.status = 'vault'
          AND cb2.vault_start IS NOT NULL
          AND cb2.id <> e.id
          AND (
            COALESCE(m2.priority_score, cb2.priority_score, 0) > e.member_priority_score
            OR (
              COALESCE(m2.priority_score, cb2.priority_score, 0) = e.member_priority_score
              AND cb2.created_at < e.created_at
            )
          )
      )
      ELSE NULL
    END AS queue_position,
    (
      SELECT COUNT(*)::integer
      FROM public.circle_bids cb3
      WHERE cb3.tier = e.tier
        AND cb3.status = 'vault'
        AND cb3.vault_start IS NOT NULL
    ) AS total_active,
    CASE
      WHEN e.derived_vault_end IS NOT NULL THEN EXTRACT(EPOCH FROM (e.derived_vault_end - now())) / 86400
      ELSE NULL
    END AS days_remaining,
    CASE
      WHEN e.derived_vault_end IS NOT NULL THEN EXTRACT(EPOCH FROM (e.derived_vault_end - now())) / 3600
      ELSE NULL
    END AS hours_remaining
  FROM enriched e;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_circle_queue_status() TO authenticated;