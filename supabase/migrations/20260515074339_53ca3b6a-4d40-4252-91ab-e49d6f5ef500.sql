REVOKE SELECT (correct_answer) ON public.predictor_questions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_predictor_answer(_question uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT correct_answer
    FROM public.predictor_questions
   WHERE id = _question
     AND (public.is_admin(auth.uid()) OR closes_at < now());
$$;

DROP POLICY IF EXISTS da_select_all ON public.drive_allocations;
DROP POLICY IF EXISTS de_select_leaderboard ON public.drive_enrollments;

CREATE OR REPLACE FUNCTION public.protect_privileged_member_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.kyc_status := OLD.kyc_status;
  NEW.kyc_level := OLD.kyc_level;
  NEW.kyc_verified_at := OLD.kyc_verified_at;
  NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  NEW.kyc_override_reason := OLD.kyc_override_reason;
  NEW.kyc_override_by := OLD.kyc_override_by;
  NEW.kyc_referral_bonus_paid := OLD.kyc_referral_bonus_paid;
  NEW.rank := OLD.rank;
  NEW.priority_score := OLD.priority_score;
  NEW.consistency_score := OLD.consistency_score;
  NEW.streak_count := OLD.streak_count;
  NEW.has_buyers_club_access := OLD.has_buyers_club_access;
  NEW.buyers_club_status := OLD.buyers_club_status;
  NEW.buyers_club_tier := OLD.buyers_club_tier;
  NEW.buyers_club_approved_at := OLD.buyers_club_approved_at;
  NEW.buyers_club_started_at := OLD.buyers_club_started_at;
  NEW.buyers_club_renewal_at := OLD.buyers_club_renewal_at;
  NEW.buyers_club_rejection_reason := OLD.buyers_club_rejection_reason;
  NEW.paystack_customer_code := OLD.paystack_customer_code;
  NEW.has_contributed := OLD.has_contributed;
  NEW.first_contribution_at := OLD.first_contribution_at;
  IF OLD.referred_by IS NOT NULL THEN
    NEW.referred_by := OLD.referred_by;
  END IF;
  IF OLD.referred_by_code IS NOT NULL THEN
    NEW.referred_by_code := OLD.referred_by_code;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.fa_force_safe_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fa_force_safe_insert_trg ON public.fulfillment_applications;
CREATE TRIGGER fa_force_safe_insert_trg
  BEFORE INSERT ON public.fulfillment_applications
  FOR EACH ROW EXECUTE FUNCTION public.fa_force_safe_insert();

DROP POLICY IF EXISTS ai_subs_update ON public.ai_subscriptions;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='ai_subscriptions' AND policyname='ai_subs_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY ai_subs_admin_all ON public.ai_subscriptions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))';
  END IF;
END $$;

REVOKE SELECT (seller_id, buyer_id) ON public.spark_exchange FROM anon, authenticated;
CREATE OR REPLACE VIEW public.spark_exchange_mine AS
  SELECT * FROM public.spark_exchange
   WHERE auth.uid() = seller_id OR auth.uid() = buyer_id;
GRANT SELECT ON public.spark_exchange_mine TO authenticated;

REVOKE SELECT (member_id) ON public.market_listings FROM anon;

REVOKE SELECT (gps_tracker_id) ON public.drive_winners FROM anon, authenticated;