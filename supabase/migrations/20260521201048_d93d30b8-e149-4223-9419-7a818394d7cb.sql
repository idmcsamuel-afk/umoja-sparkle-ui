-- Allow trusted referral functions to set referred_by/referred_by_code once,
-- while keeping direct member privilege edits blocked.
CREATE OR REPLACE FUNCTION public.prevent_member_privileged_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allow_referral_link boolean := current_setting('app.allow_referral_link_write', true) = 'on';
  referral_changed boolean :=
    NEW.referred_by IS DISTINCT FROM OLD.referred_by
    OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code;
  non_ref_privileged_changed boolean :=
    NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
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
    OR NEW.paystack_customer_code IS DISTINCT FROM OLD.paystack_customer_code
    OR NEW.paystack_plan_code IS DISTINCT FROM OLD.paystack_plan_code
    OR NEW.paystack_subscription_code IS DISTINCT FROM OLD.paystack_subscription_code
    OR NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF non_ref_privileged_changed THEN
    RAISE EXCEPTION 'permission denied: cannot modify privileged member field';
  END IF;

  IF referral_changed AND NOT (
    allow_referral_link
    AND OLD.referred_by IS NULL
    AND OLD.referred_by_code IS NULL
    AND NEW.referred_by IS NOT NULL
    AND NEW.referred_by <> NEW.id
  ) THEN
    RAISE EXCEPTION 'permission denied: cannot modify privileged member field';
  END IF;

  RETURN NEW;
END
$function$;

-- Capture referral code from signup metadata at member row creation time.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referral_code_from_meta text := upper(nullif(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), ''));
  referrer_id uuid;
BEGIN
  IF referral_code_from_meta IS NOT NULL THEN
    SELECT id INTO referrer_id
      FROM public.members
     WHERE referral_code = referral_code_from_meta
       AND id <> NEW.id
     LIMIT 1;
  END IF;

  INSERT INTO public.members (id, full_name, phone, email, referred_by, referred_by_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Member'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NEW.email, NEW.id::text),
    NEW.email,
    referrer_id,
    CASE WHEN referrer_id IS NOT NULL THEN referral_code_from_meta ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END
$function$;

-- Make referral application idempotent: link if missing, credit only once.
CREATE OR REPLACE FUNCTION public.apply_referral_signup(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  normalized_code text := upper(nullif(trim(COALESCE(_code, '')), ''));
  ref_member public.members%ROWTYPE;
  me public.members%ROWTYPE;
  already_credited boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF normalized_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;

  SELECT * INTO me FROM public.members WHERE id = uid;
  IF me.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member_not_found');
  END IF;

  SELECT * INTO ref_member FROM public.members WHERE referral_code = normalized_code;
  IF ref_member.id IS NULL OR ref_member.id = uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF (me.referred_by IS NOT NULL AND me.referred_by <> ref_member.id)
     OR (me.referred_by_code IS NOT NULL AND me.referred_by_code <> normalized_code) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  IF me.referred_by IS NULL OR me.referred_by_code IS NULL THEN
    PERFORM set_config('app.allow_referral_link_write', 'on', true);
    UPDATE public.members
       SET referred_by_code = normalized_code,
           referred_by = ref_member.id
     WHERE id = uid
       AND referred_by IS NULL
       AND referred_by_code IS NULL;
    PERFORM set_config('app.allow_referral_link_write', 'off', true);
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.spark_transactions
     WHERE from_member = uid
       AND to_member = ref_member.id
       AND tx_type = 'referral_signup'
  ) INTO already_credited;

  IF NOT already_credited THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    INSERT INTO public.spark_wallets (member_id, balance)
      VALUES (ref_member.id, 100)
      ON CONFLICT (member_id) DO UPDATE
        SET balance = public.spark_wallets.balance + 100,
            updated_at = now();
    PERFORM set_config('app.allow_wallet_write', 'off', true);

    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
      VALUES (uid, ref_member.id, 100, 'referral_signup', 'completed');

    INSERT INTO public.notifications (member_id, title, body, kind, link)
      VALUES (ref_member.id, 'You earned 100 Sparks ✨',
              COALESCE(me.full_name, 'A new member') || ' joined using your referral link.',
              'referral', '/referrals');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', CASE WHEN already_credited THEN 'already_credited' ELSE 'credited' END,
    'referrer_name', ref_member.full_name,
    'referrer_id', ref_member.id
  );
END
$function$;

-- Backfill backend relationships where a referral Sparks transaction already exists.
SELECT set_config('app.allow_referral_link_write', 'on', true);
UPDATE public.members m
   SET referred_by = ref.id,
       referred_by_code = ref.referral_code
  FROM public.spark_transactions tx
  JOIN public.members ref ON ref.id = tx.to_member
 WHERE tx.tx_type = 'referral_signup'
   AND tx.from_member = m.id
   AND tx.to_member <> m.id
   AND m.referred_by IS NULL
   AND m.referred_by_code IS NULL;
SELECT set_config('app.allow_referral_link_write', 'off', true);

-- Correct the specific reported referral: sunnestine71@gmail.com referred by tidagifts@gmail.com.
DO $do$
DECLARE
  target_member public.members%ROWTYPE;
  ref_member public.members%ROWTYPE;
  already_credited boolean := false;
BEGIN
  SELECT * INTO target_member FROM public.members WHERE lower(email) = 'sunnestine71@gmail.com' LIMIT 1;
  SELECT * INTO ref_member FROM public.members WHERE lower(email) = 'tidagifts@gmail.com' LIMIT 1;

  IF target_member.id IS NOT NULL AND ref_member.id IS NOT NULL AND target_member.id <> ref_member.id THEN
    IF target_member.referred_by IS NULL AND target_member.referred_by_code IS NULL THEN
      PERFORM set_config('app.allow_referral_link_write', 'on', true);
      UPDATE public.members
         SET referred_by = ref_member.id,
             referred_by_code = ref_member.referral_code
       WHERE id = target_member.id;
      PERFORM set_config('app.allow_referral_link_write', 'off', true);
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.spark_transactions
       WHERE from_member = target_member.id
         AND to_member = ref_member.id
         AND tx_type = 'referral_signup'
    ) INTO already_credited;

    IF NOT already_credited THEN
      PERFORM set_config('app.allow_wallet_write', 'on', true);
      INSERT INTO public.spark_wallets (member_id, balance)
        VALUES (ref_member.id, 100)
        ON CONFLICT (member_id) DO UPDATE
          SET balance = public.spark_wallets.balance + 100,
              updated_at = now();
      PERFORM set_config('app.allow_wallet_write', 'off', true);

      INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
        VALUES (target_member.id, ref_member.id, 100, 'referral_signup', 'completed');
    END IF;
  END IF;
END
$do$;