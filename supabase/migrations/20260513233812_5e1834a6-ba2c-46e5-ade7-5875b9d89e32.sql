
-- 1) Extend drive_tiers with new columns
ALTER TABLE public.drive_tiers
  ADD COLUMN IF NOT EXISTS tier_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS vehicle_description text,
  ADD COLUMN IF NOT EXISTS retail_value numeric,
  ADD COLUMN IF NOT EXISTS umoja_cost numeric,
  ADD COLUMN IF NOT EXISTS cars_per_allocation integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS min_contribution_before numeric,
  ADD COLUMN IF NOT EXISTS weekly_payment_before_min numeric,
  ADD COLUMN IF NOT EXISTS weekly_payment_before_max numeric,
  ADD COLUMN IF NOT EXISTS weekly_payment_after numeric,
  ADD COLUMN IF NOT EXISTS payback_weeks integer,
  ADD COLUMN IF NOT EXISTS requires_buyers_club_tier text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Deactivate any legacy tier rows that don't match new program
UPDATE public.drive_tiers SET is_active = false WHERE tier_name IS NULL;

-- Seed the 3 new tiers (idempotent on tier_name)
INSERT INTO public.drive_tiers
  (name, tier_name, display_name, vehicle_description, retail_value, umoja_cost,
   pool_target, cars_per_allocation, min_contribution_before,
   weekly_payment_before_min, weekly_payment_before_max,
   weekly_payment_after, payback_weeks, requires_buyers_club_tier,
   weekly_contribution, circle_size, status, is_active)
VALUES
  ('Economy Drive','economy','Economy Drive',
   'Perfect for Uber, Bolt, delivery business. Chinese sedans (Chery, Haval, GWM)',
   120000, 80000, 400000, 5, 10000, 250, 500, 1200, 50, NULL,
   400, 5, 'active', true),
  ('Standard Drive','standard','Standard Drive',
   'Perfect for family & business use. Mid-range sedans/SUVs',
   180000, 115000, 575000, 5, 20000, 500, 1500, 1500, 60, NULL,
   1000, 5, 'active', true),
  ('Premium Drive','premium','Premium Drive',
   'Luxury sedans/SUVs for high performers. Haval H9, Jetour X90 Plus',
   350000, 220000, 1100000, 5, 50000, 2000, 5000, 2500, 80, 'gold',
   3500, 5, 'active', true)
ON CONFLICT DO NOTHING;

-- Create unique constraint on tier_name where present
CREATE UNIQUE INDEX IF NOT EXISTS drive_tiers_tier_name_uidx
  ON public.drive_tiers(tier_name) WHERE tier_name IS NOT NULL;

-- 2) Enrollments
CREATE TABLE IF NOT EXISTS public.drive_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  tier_id uuid NOT NULL REFERENCES public.drive_tiers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  won_at timestamptz,
  completed_at timestamptz,
  weekly_amount numeric NOT NULL DEFAULT 0,
  priority_score numeric NOT NULL DEFAULT 0,
  total_contributed numeric NOT NULL DEFAULT 0,
  weeks_contributed integer NOT NULL DEFAULT 0,
  weeks_paid_on_time integer NOT NULL DEFAULT 0,
  referrals_count integer NOT NULL DEFAULT 0,
  UNIQUE(member_id, tier_id)
);
ALTER TABLE public.drive_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS de_select ON public.drive_enrollments;
CREATE POLICY de_select ON public.drive_enrollments FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR is_admin(auth.uid()));
DROP POLICY IF EXISTS de_insert ON public.drive_enrollments;
CREATE POLICY de_insert ON public.drive_enrollments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS de_update_own ON public.drive_enrollments;
CREATE POLICY de_update_own ON public.drive_enrollments FOR UPDATE TO authenticated
  USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS de_admin_all ON public.drive_enrollments;
CREATE POLICY de_admin_all ON public.drive_enrollments FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Public read of leaderboard data (no PII) - we'll join to members with limited cols
DROP POLICY IF EXISTS de_select_leaderboard ON public.drive_enrollments;
CREATE POLICY de_select_leaderboard ON public.drive_enrollments FOR SELECT TO authenticated
  USING (true);

-- 3) Contributions
CREATE TABLE IF NOT EXISTS public.drive_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.drive_enrollments(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  amount numeric NOT NULL,
  week_number integer NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  is_on_time boolean NOT NULL DEFAULT true,
  payment_method text,
  payment_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drive_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dc_select ON public.drive_contributions;
CREATE POLICY dc_select ON public.drive_contributions FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR is_admin(auth.uid()));
DROP POLICY IF EXISTS dc_insert ON public.drive_contributions;
CREATE POLICY dc_insert ON public.drive_contributions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id);
DROP POLICY IF EXISTS dc_admin_all ON public.drive_contributions;
CREATE POLICY dc_admin_all ON public.drive_contributions FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 4) Allocations
CREATE TABLE IF NOT EXISTS public.drive_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.drive_tiers(id),
  allocation_date date NOT NULL DEFAULT CURRENT_DATE,
  pool_amount numeric NOT NULL,
  cars_allocated integer NOT NULL,
  allocation_results jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drive_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS da_admin_all ON public.drive_allocations;
CREATE POLICY da_admin_all ON public.drive_allocations FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
DROP POLICY IF EXISTS da_select_all ON public.drive_allocations;
CREATE POLICY da_select_all ON public.drive_allocations FOR SELECT TO authenticated
  USING (true);

-- 5) Winners
CREATE TABLE IF NOT EXISTS public.drive_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.drive_enrollments(id),
  allocation_id uuid REFERENCES public.drive_allocations(id),
  member_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  vehicle_details jsonb,
  handover_date date,
  gps_tracker_id text,
  weekly_payback numeric NOT NULL,
  weeks_remaining integer,
  total_paid_back numeric NOT NULL DEFAULT 0,
  papers_released boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drive_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dw_select ON public.drive_winners;
CREATE POLICY dw_select ON public.drive_winners FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR is_admin(auth.uid()));
DROP POLICY IF EXISTS dw_admin_all ON public.drive_winners;
CREATE POLICY dw_admin_all ON public.drive_winners FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 6) Score RPC
CREATE OR REPLACE FUNCTION public.calculate_drive_score(p_enrollment_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score numeric := 0;
  v_engagement numeric := 0;
  v_enrollment public.drive_enrollments;
  v_tier public.drive_tiers;
  v_max_weeks numeric;
  v_my_weeks numeric;
BEGIN
  SELECT * INTO v_enrollment FROM public.drive_enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_tier FROM public.drive_tiers WHERE id = v_enrollment.tier_id;

  -- 1) Contribution Volume (30)
  IF v_tier.min_contribution_before > 0 THEN
    v_score := v_score + LEAST((v_enrollment.total_contributed / v_tier.min_contribution_before) * 30, 30);
  END IF;

  -- 2) Payment Consistency (30)
  IF v_enrollment.weeks_contributed > 0 THEN
    v_score := v_score + (v_enrollment.weeks_paid_on_time::numeric / v_enrollment.weeks_contributed::numeric) * 30;
  END IF;

  -- 3) Referrals (15)
  v_score := v_score + LEAST(v_enrollment.referrals_count * 3, 15);

  -- 4) Platform Engagement (10)
  SELECT
    (CASE WHEN EXISTS(SELECT 1 FROM public.circle_bids WHERE member_id = v_enrollment.member_id AND COALESCE(status,'') IN ('active','vault','payment_pending','pending')) THEN 3 ELSE 0 END) +
    (CASE WHEN m.has_buyers_club_access THEN 3 ELSE 0 END) +
    (CASE WHEN m.kyc_status = 'approved' THEN 2 ELSE 0 END) +
    (CASE WHEN EXISTS(SELECT 1 FROM public.spark_trade_joins WHERE member_id = v_enrollment.member_id) THEN 2 ELSE 0 END)
  INTO v_engagement
  FROM public.members m WHERE m.id = v_enrollment.member_id;
  v_score := v_score + COALESCE(v_engagement, 0);

  -- 5) Time Waiting (10)
  SELECT MAX(EXTRACT(EPOCH FROM (NOW() - enrolled_at)) / 604800)
    INTO v_max_weeks FROM public.drive_enrollments WHERE tier_id = v_enrollment.tier_id;
  v_my_weeks := EXTRACT(EPOCH FROM (NOW() - v_enrollment.enrolled_at)) / 604800;
  IF v_max_weeks > 0 THEN
    v_score := v_score + (v_my_weeks / v_max_weeks) * 10;
  END IF;

  UPDATE public.drive_enrollments SET priority_score = ROUND(v_score, 2) WHERE id = p_enrollment_id;
  RETURN ROUND(v_score, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_drive_score(uuid) TO authenticated;

-- 7) Pool totals helper view (unrestricted)
CREATE OR REPLACE VIEW public.drive_tier_pool_v AS
SELECT t.id AS tier_id,
       t.tier_name,
       COALESCE(SUM(e.total_contributed),0) AS pool_total,
       COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'active') AS active_members
FROM public.drive_tiers t
LEFT JOIN public.drive_enrollments e ON e.tier_id = t.id
GROUP BY t.id, t.tier_name;

GRANT SELECT ON public.drive_tier_pool_v TO authenticated, anon;

-- 8) Run-allocation RPC (admin only)
CREATE OR REPLACE FUNCTION public.run_drive_allocation(p_tier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.drive_tiers;
  v_alloc_id uuid;
  v_winners jsonb;
  v_pool numeric;
  v_count int;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO v_tier FROM public.drive_tiers WHERE id = p_tier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tier_not_found'; END IF;

  -- Recalculate scores for active enrollments in this tier
  PERFORM public.calculate_drive_score(e.id)
    FROM public.drive_enrollments e
    WHERE e.tier_id = p_tier_id AND e.status = 'active';

  SELECT COALESCE(SUM(total_contributed),0) INTO v_pool
    FROM public.drive_enrollments WHERE tier_id = p_tier_id;

  WITH ranked AS (
    SELECT e.id, e.member_id, e.priority_score, e.total_contributed,
           ROW_NUMBER() OVER (ORDER BY e.priority_score DESC, e.enrolled_at ASC) AS rnk
    FROM public.drive_enrollments e
    WHERE e.tier_id = p_tier_id AND e.status = 'active'
  ),
  top_winners AS (
    SELECT * FROM ranked WHERE rnk <= v_tier.cars_per_allocation
  )
  SELECT jsonb_agg(jsonb_build_object(
    'enrollment_id', id, 'member_id', member_id,
    'score', priority_score, 'rank', rnk,
    'total_contributed', total_contributed
  )) INTO v_winners FROM top_winners;

  v_count := COALESCE(jsonb_array_length(v_winners), 0);

  INSERT INTO public.drive_allocations
    (tier_id, allocation_date, pool_amount, cars_allocated, allocation_results, created_by)
  VALUES (p_tier_id, CURRENT_DATE, v_pool, v_count, v_winners, auth.uid())
  RETURNING id INTO v_alloc_id;

  -- Mark winners
  UPDATE public.drive_enrollments
     SET status = 'winner', won_at = now()
   WHERE id IN (SELECT (w->>'enrollment_id')::uuid FROM jsonb_array_elements(COALESCE(v_winners,'[]'::jsonb)) w);

  -- Insert winner rows
  INSERT INTO public.drive_winners
    (enrollment_id, allocation_id, member_id, tier_id, weekly_payback, weeks_remaining)
  SELECT (w->>'enrollment_id')::uuid, v_alloc_id, (w->>'member_id')::uuid, p_tier_id,
         v_tier.weekly_payment_after, v_tier.payback_weeks
  FROM jsonb_array_elements(COALESCE(v_winners,'[]'::jsonb)) w;

  RETURN jsonb_build_object('allocation_id', v_alloc_id, 'cars', v_count, 'pool', v_pool, 'winners', v_winners);
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_drive_allocation(uuid) TO authenticated;
