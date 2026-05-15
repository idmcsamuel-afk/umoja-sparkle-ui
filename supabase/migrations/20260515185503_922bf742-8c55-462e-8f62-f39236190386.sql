
-- 1) MEMBERS: restrict privileged column writes by non-admins
DROP POLICY IF EXISTS members_all ON public.members;

CREATE POLICY members_select_self ON public.members
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY members_insert_self ON public.members
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY members_update_self ON public.members
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY members_delete_self ON public.members
  FOR DELETE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_member_privileged_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.kyc_level IS DISTINCT FROM OLD.kyc_level
     OR NEW.kyc_verified_at IS DISTINCT FROM OLD.kyc_verified_at
     OR NEW.kyc_override_by IS DISTINCT FROM OLD.kyc_override_by
     OR NEW.kyc_override_reason IS DISTINCT FROM OLD.kyc_override_reason
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR NEW.kyc_referral_bonus_paid IS DISTINCT FROM OLD.kyc_referral_bonus_paid
     OR NEW.kyc_last_reminder_at IS DISTINCT FROM OLD.kyc_last_reminder_at
     OR NEW.kyc_reminder_count IS DISTINCT FROM OLD.kyc_reminder_count
     OR NEW.has_buyers_club_access IS DISTINCT FROM OLD.has_buyers_club_access
     OR NEW.buyers_club_tier IS DISTINCT FROM OLD.buyers_club_tier
     OR NEW.buyers_club_status IS DISTINCT FROM OLD.buyers_club_status
     OR NEW.buyers_club_approved_at IS DISTINCT FROM OLD.buyers_club_approved_at
     OR NEW.buyers_club_started_at IS DISTINCT FROM OLD.buyers_club_started_at
     OR NEW.buyers_club_renewal_at IS DISTINCT FROM OLD.buyers_club_renewal_at
     OR NEW.buyers_club_rejection_reason IS DISTINCT FROM OLD.buyers_club_rejection_reason
     OR NEW.priority_score IS DISTINCT FROM OLD.priority_score
     OR NEW.consistency_score IS DISTINCT FROM OLD.consistency_score
     OR NEW.community_score IS DISTINCT FROM OLD.community_score
     OR NEW.contribution_volume_score IS DISTINCT FROM OLD.contribution_volume_score
     OR NEW.bid_boost_score IS DISTINCT FROM OLD.bid_boost_score
     OR NEW.time_waiting_score IS DISTINCT FROM OLD.time_waiting_score
     OR NEW.streak_count IS DISTINCT FROM OLD.streak_count
     OR NEW.total_cycles IS DISTINCT FROM OLD.total_cycles
     OR NEW.has_contributed IS DISTINCT FROM OLD.has_contributed
     OR NEW.first_contribution_at IS DISTINCT FROM OLD.first_contribution_at
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
     OR NEW.paystack_customer_code IS DISTINCT FROM OLD.paystack_customer_code
     OR NEW.paystack_plan_code IS DISTINCT FROM OLD.paystack_plan_code
     OR NEW.paystack_subscription_code IS DISTINCT FROM OLD.paystack_subscription_code
     OR NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference
  THEN
    RAISE EXCEPTION 'permission denied: cannot modify privileged member field';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_members_prevent_privileged ON public.members;
CREATE TRIGGER trg_members_prevent_privileged
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_privileged_writes();

-- 2) FULFILLMENT_APPLICATIONS: lock down INSERT
DROP POLICY IF EXISTS fa_insert ON public.fulfillment_applications;
CREATE POLICY fa_insert ON public.fulfillment_applications
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    AND COALESCE(status, 'pending') = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
  );

-- 3) PREDICTOR_QUESTIONS: hide correct_answer from non-admins
REVOKE SELECT (correct_answer) ON public.predictor_questions FROM anon, authenticated;
-- admins query via admin_list_predictor_questions() which is SECURITY DEFINER

-- 4) SPARK_EXCHANGE: restrict closed trades to participants
DROP POLICY IF EXISTS exchange_select ON public.spark_exchange;
CREATE POLICY exchange_select_open ON public.spark_exchange
  FOR SELECT USING (status = 'open');
CREATE POLICY exchange_select_participant ON public.spark_exchange
  FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id OR public.is_admin(auth.uid()));
