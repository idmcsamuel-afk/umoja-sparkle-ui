CREATE OR REPLACE FUNCTION public.award_kyc_referral_bonus(_member uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target uuid := COALESCE(_member, auth.uid());
  m public.members%ROWTYPE;
  ref_member public.members%ROWTYPE;
BEGIN
  IF target IS NULL THEN RETURN false; END IF;
  IF _member IS NOT NULL AND _member <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO m FROM public.members WHERE id = target;
  IF m.id IS NULL OR m.kyc_level < 3 OR m.kyc_referral_bonus_paid OR m.referred_by IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO ref_member FROM public.members WHERE id = m.referred_by;
  IF ref_member.id IS NULL THEN RETURN false; END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (ref_member.id, 30)
    ON CONFLICT (member_id) DO UPDATE
      SET balance = public.spark_wallets.balance + 30,
          updated_at = now();
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  UPDATE public.members SET kyc_referral_bonus_paid = true WHERE id = target;

  INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
    VALUES (target, ref_member.id, 30, 'referral_kyc_bonus', 'completed');

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (ref_member.id, 'KYC referral bonus +30 Sparks 🎉',
            COALESCE(m.full_name, 'Your referred member') || ' completed verification.',
            'referral', '/referrals');

  RETURN true;
END $function$;