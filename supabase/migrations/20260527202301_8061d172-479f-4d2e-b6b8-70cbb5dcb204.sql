
-- ============ fraud_flags ============
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_member ON public.fraud_flags(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_type ON public.fraud_flags(flag_type);

GRANT ALL ON public.fraud_flags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_flags TO authenticated;

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud_flags"
  ON public.fraud_flags FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ fraud_scores ============
CREATE TABLE IF NOT EXISTS public.fraud_scores (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  risk_level text NOT NULL DEFAULT 'green' CHECK (risk_level IN ('green','yellow','orange','red')),
  breakdown jsonb DEFAULT '{}'::jsonb,
  last_calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fraud_scores_level ON public.fraud_scores(risk_level, score DESC);

GRANT ALL ON public.fraud_scores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_scores TO authenticated;

ALTER TABLE public.fraud_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud_scores"
  ON public.fraud_scores FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ investigation_cases ============
CREATE TABLE IF NOT EXISTS public.investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','dismissed')),
  assigned_to uuid REFERENCES public.members(id),
  opened_reason text,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_inv_cases_status ON public.investigation_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_cases_member ON public.investigation_cases(member_id);

GRANT ALL ON public.investigation_cases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigation_cases TO authenticated;

ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage investigation_cases"
  ON public.investigation_cases FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ calculate_fraud_score ============
CREATE OR REPLACE FUNCTION public.calculate_fraud_score(_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.members%ROWTYPE;
  age_days int;
  engagement int := 0;
  withdrawal_cnt int := 0;
  rapid_withdraw boolean := false;
  flag_cnt int := 0;
  kyc_rejected boolean := false;
  ref_velocity int := 0;
  score int := 0;
  age_pts int := 0;
  engagement_pts int := 0;
  withdraw_pts int := 0;
  flag_pts int := 0;
  kyc_pts int := 0;
  ref_pts int := 0;
  level text;
  breakdown jsonb;
BEGIN
  SELECT * INTO m FROM public.members WHERE id = _member;
  IF m.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  age_days := GREATEST(0, EXTRACT(DAY FROM (now() - m.created_at))::int);
  IF age_days < 1 THEN age_pts := 20;
  ELSIF age_days < 7 THEN age_pts := 15;
  ELSIF age_days < 30 THEN age_pts := 8;
  ELSE age_pts := 0;
  END IF;

  SELECT COUNT(*) INTO engagement FROM public.circle_bids WHERE member_id = _member;
  IF engagement = 0 THEN engagement_pts := 10; END IF;

  SELECT COUNT(*) INTO withdrawal_cnt FROM public.withdrawal_requests WHERE member_id = _member;
  SELECT EXISTS(
    SELECT 1 FROM public.withdrawal_requests
    WHERE member_id = _member
      AND created_at < m.created_at + interval '14 days'
      AND created_at > m.created_at + interval '7 days'
  ) INTO rapid_withdraw;
  withdraw_pts := LEAST(20, withdrawal_cnt * 3) + (CASE WHEN rapid_withdraw THEN 15 ELSE 0 END);

  SELECT COUNT(*) INTO flag_cnt FROM public.fraud_flags
    WHERE member_id = _member AND resolved_at IS NULL;
  flag_pts := LEAST(30, flag_cnt * 8);

  IF m.kyc_status = 'rejected' THEN kyc_pts := 15; kyc_rejected := true; END IF;

  -- Referral velocity: members referred in last 7 days
  SELECT COUNT(*) INTO ref_velocity FROM public.members
    WHERE referred_by = _member AND created_at > now() - interval '7 days';
  IF ref_velocity > 20 THEN ref_pts := 20;
  ELSIF ref_velocity > 10 THEN ref_pts := 10;
  ELSIF ref_velocity > 5 THEN ref_pts := 4;
  END IF;

  score := LEAST(100, age_pts + engagement_pts + withdraw_pts + flag_pts + kyc_pts + ref_pts);
  level := CASE
    WHEN score >= 81 THEN 'red'
    WHEN score >= 51 THEN 'orange'
    WHEN score >= 21 THEN 'yellow'
    ELSE 'green'
  END;

  breakdown := jsonb_build_object(
    'age_days', age_days, 'age_pts', age_pts,
    'engagement_count', engagement, 'engagement_pts', engagement_pts,
    'withdrawal_count', withdrawal_cnt, 'rapid_withdraw', rapid_withdraw, 'withdraw_pts', withdraw_pts,
    'open_flags', flag_cnt, 'flag_pts', flag_pts,
    'kyc_rejected', kyc_rejected, 'kyc_pts', kyc_pts,
    'recent_referrals', ref_velocity, 'ref_pts', ref_pts
  );

  INSERT INTO public.fraud_scores(member_id, score, risk_level, breakdown, last_calculated_at)
    VALUES (_member, score, level, breakdown, now())
    ON CONFLICT (member_id) DO UPDATE
      SET score = EXCLUDED.score,
          risk_level = EXCLUDED.risk_level,
          breakdown = EXCLUDED.breakdown,
          last_calculated_at = now();

  -- Auto-open investigation case at red
  IF level = 'red' AND NOT EXISTS(
    SELECT 1 FROM public.investigation_cases
    WHERE member_id = _member AND status IN ('open','under_review')
  ) THEN
    INSERT INTO public.investigation_cases(member_id, opened_reason)
      VALUES (_member, 'Auto-opened: fraud score ' || score);
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', score, 'risk_level', level, 'breakdown', breakdown);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_fraud_score(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.calculate_fraud_score(uuid) TO authenticated, service_role;

-- ============ admin_recalc_all_fraud_scores ============
CREATE OR REPLACE FUNCTION public.admin_recalc_all_fraud_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; n int := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR r IN SELECT id FROM public.members LOOP
    PERFORM public.calculate_fraud_score(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recalc_all_fraud_scores() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_recalc_all_fraud_scores() TO authenticated;

-- ============ admin_freeze_member / unfreeze ============
CREATE OR REPLACE FUNCTION public.admin_freeze_member(_member uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members SET status = 'frozen' WHERE id = _member;
  INSERT INTO public.fraud_flags(member_id, flag_type, severity, details)
    VALUES (_member, 'account_frozen', 'critical', jsonb_build_object('reason', _reason, 'by', auth.uid()));
  INSERT INTO public.admin_audit_log(actor_id, action, target_member, details)
    VALUES (auth.uid(), 'freeze_member', _member, jsonb_build_object('reason', _reason));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_freeze_member(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_freeze_member(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unfreeze_member(_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members SET status = 'active' WHERE id = _member;
  UPDATE public.fraud_flags SET resolved_at = now()
    WHERE member_id = _member AND flag_type = 'account_frozen' AND resolved_at IS NULL;
  INSERT INTO public.admin_audit_log(actor_id, action, target_member, details)
    VALUES (auth.uid(), 'unfreeze_member', _member, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_unfreeze_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_member(uuid) TO authenticated;

-- ============ admin_fraud_dashboard ============
CREATE OR REPLACE FUNCTION public.admin_fraud_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'risk_counts', (
      SELECT jsonb_object_agg(risk_level, n) FROM (
        SELECT risk_level, COUNT(*) AS n FROM public.fraud_scores GROUP BY risk_level
      ) q
    ),
    'flags_today', (SELECT COUNT(*) FROM public.fraud_flags WHERE created_at > now() - interval '24 hours'),
    'open_cases', (SELECT COUNT(*) FROM public.investigation_cases WHERE status IN ('open','under_review')),
    'frozen_members', (SELECT COUNT(*) FROM public.members WHERE status = 'frozen')
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_fraud_dashboard() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_fraud_dashboard() TO authenticated;

-- ============ admin_revenue_dashboard ============
CREATE OR REPLACE FUNCTION public.admin_revenue_dashboard(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d int := GREATEST(1, LEAST(_days, 90));
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'spark_purchases_zar', COALESCE((
        SELECT SUM(platform_fee + net_amount + ubuntu_fund_cut) FROM public.circle_bids
        WHERE status IN ('paid','vault','matched','active')
          AND created_at > now() - interval '24 hours'
      ), 0),
      'withdrawals_zar', COALESCE((
        SELECT SUM(amount_r_net) FROM public.withdrawal_requests
        WHERE status IN ('pending','processing','completed')
          AND created_at > now() - interval '24 hours'
      ), 0),
      'withdrawals_count', COALESCE((
        SELECT COUNT(*) FROM public.withdrawal_requests
        WHERE created_at > now() - interval '24 hours'
      ), 0),
      'flip_house_sparks', COALESCE((
        SELECT SUM(bet_sparks - COALESCE(payout,0)) FROM public.spark_flip_games
        WHERE created_at > now() - interval '24 hours'
      ), 0),
      'new_signups', COALESCE((
        SELECT COUNT(*) FROM public.members
        WHERE created_at > now() - interval '24 hours'
      ), 0),
      'active_players', COALESCE((
        SELECT COUNT(DISTINCT member_id) FROM public.spark_flip_games
        WHERE created_at > now() - interval '24 hours'
      ), 0)
    ),
    'totals', jsonb_build_object(
      'total_members', (SELECT COUNT(*) FROM public.members),
      'churn_rate_pct', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(100.0 * SUM(CASE WHEN last_seen_at IS NULL OR last_seen_at < now() - interval '7 days' THEN 1 ELSE 0 END) / COUNT(*), 1)
        END FROM public.members
      )
    ),
    'trend', (
      SELECT jsonb_agg(jsonb_build_object(
        'day', day,
        'purchases', purchases,
        'withdrawals', withdrawals,
        'flip_house', flip_house
      ) ORDER BY day) FROM (
        SELECT
          to_char(g.day, 'YYYY-MM-DD') AS day,
          COALESCE((SELECT SUM(fiat_amount) FROM public.circle_bids
            WHERE status IN ('paid','vault','matched','active')
              AND date_trunc('day', created_at) = g.day), 0) AS purchases,
          COALESCE((SELECT SUM(amount_r_net) FROM public.withdrawal_requests
            WHERE status IN ('pending','processing','completed')
              AND date_trunc('day', created_at) = g.day), 0) AS withdrawals,
          COALESCE((SELECT SUM(bet_sparks - COALESCE(payout,0)) FROM public.spark_flip_games
            WHERE date_trunc('day', created_at) = g.day), 0) AS flip_house
        FROM generate_series(date_trunc('day', now()) - ((d - 1) || ' days')::interval, date_trunc('day', now()), '1 day'::interval) AS g(day)
      ) tr
    )
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revenue_dashboard(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_revenue_dashboard(integer) TO authenticated;
