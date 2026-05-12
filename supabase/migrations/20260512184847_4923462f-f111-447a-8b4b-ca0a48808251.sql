
CREATE OR REPLACE FUNCTION public.claim_signup_bonus()
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE existing numeric; new_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT balance INTO existing FROM public.spark_wallets WHERE member_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (auth.uid(), 50)
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);
  RETURN new_balance;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_referral_signup(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  ref_member public.members%ROWTYPE;
  me public.members%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _code IS NULL OR length(_code) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_code');
  END IF;

  SELECT * INTO me FROM public.members WHERE id = uid;
  IF me.referred_by_code IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT * INTO ref_member FROM public.members WHERE referral_code = upper(_code);
  IF ref_member.id IS NULL OR ref_member.id = uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  UPDATE public.members
     SET referred_by_code = upper(_code),
         referred_by = ref_member.id
   WHERE id = uid;

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

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_name', ref_member.full_name,
    'referrer_id', ref_member.id
  );
END $function$;
