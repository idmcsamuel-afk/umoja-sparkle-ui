
CREATE TABLE public.circle_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid REFERENCES public.circle_allocations(id) ON DELETE CASCADE,
  tier text NOT NULL,
  session_at timestamptz NOT NULL DEFAULT now(),
  member_id uuid NOT NULL,
  bid_id uuid,
  priority_score numeric NOT NULL DEFAULT 0,
  rank integer,
  eligible boolean NOT NULL DEFAULT false,
  breakdown jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_snapshots_member_tier ON public.circle_score_snapshots(member_id, tier, session_at DESC);
CREATE INDEX idx_score_snapshots_alloc ON public.circle_score_snapshots(allocation_id);

ALTER TABLE public.circle_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_select_own
  ON public.circle_score_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));

CREATE POLICY snapshots_admin_insert
  ON public.circle_score_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Replace apply_allocation so it also writes snapshots for every active member in the tier
CREATE OR REPLACE FUNCTION public.apply_allocation(_tier text, _winner_bid_ids uuid[], _pool_total numeric, _breakdown jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  alloc_id uuid;
  per_winner numeric;
  cnt int;
  i int := 0;
  bid_id uuid;
  rec record;
  rnk int := 0;
  s record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  cnt := COALESCE(array_length(_winner_bid_ids, 1), 0);
  IF cnt = 0 THEN RAISE EXCEPTION 'no winners provided'; END IF;
  per_winner := ROUND(_pool_total / cnt, 2);

  INSERT INTO public.circle_allocations (tier, pool_total, winners_count, payout_per_winner, breakdown, created_by)
    VALUES (_tier, _pool_total, cnt, per_winner, _breakdown, auth.uid())
    RETURNING id INTO alloc_id;

  -- Snapshot every active member's score & rank at this session (eligible ranked first)
  FOR s IN
    SELECT *,
      CASE WHEN eligible THEN
        ROW_NUMBER() OVER (PARTITION BY eligible ORDER BY priority_score DESC)
      ELSE NULL END AS r
    FROM public.compute_session_scores(_tier)
  LOOP
    INSERT INTO public.circle_score_snapshots
      (allocation_id, tier, member_id, bid_id, priority_score, rank, eligible, breakdown)
    VALUES
      (alloc_id, _tier, s.member_id, s.bid_id, s.priority_score, s.r, s.eligible, s.breakdown);
  END LOOP;

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

  UPDATE public.circle_allocation_overrides
     SET consumed = true, applied_to_allocation = alloc_id
   WHERE tier = _tier AND consumed = false;

  RETURN alloc_id;
END $function$;
