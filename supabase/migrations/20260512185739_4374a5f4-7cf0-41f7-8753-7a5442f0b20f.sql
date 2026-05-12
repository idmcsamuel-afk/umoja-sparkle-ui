
CREATE OR REPLACE FUNCTION public.assign_referrer(_member uuid, _referrer uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref public.members%ROWTYPE;
  m public.members%ROWTYPE;
  already_credited boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _member = _referrer THEN RAISE EXCEPTION 'self-referral not allowed'; END IF;

  SELECT * INTO m FROM public.members WHERE id = _member;
  SELECT * INTO ref FROM public.members WHERE id = _referrer;
  IF m.id IS NULL OR ref.id IS NULL THEN RAISE EXCEPTION 'member not found'; END IF;

  UPDATE public.members
     SET referred_by = _referrer,
         referred_by_code = ref.referral_code
   WHERE id = _member;

  SELECT EXISTS (
    SELECT 1 FROM public.spark_transactions
     WHERE from_member = _member AND to_member = _referrer
       AND tx_type = 'referral_signup'
  ) INTO already_credited;

  IF NOT already_credited THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    INSERT INTO public.spark_wallets (member_id, balance)
      VALUES (_referrer, 100)
      ON CONFLICT (member_id) DO UPDATE
        SET balance = public.spark_wallets.balance + 100,
            updated_at = now();
    PERFORM set_config('app.allow_wallet_write', 'off', true);

    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
      VALUES (_member, _referrer, 100, 'referral_signup', 'completed');

    INSERT INTO public.notifications (member_id, title, body, kind, link)
      VALUES (_referrer, 'You earned 100 Sparks ✨',
              COALESCE(m.full_name,'A member') || ' was assigned to you by an admin.',
              'referral', '/referrals');
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'assign_referrer', _member,
            jsonb_build_object('referrer_id', _referrer,
                               'referrer_code', ref.referral_code,
                               'credited', NOT already_credited));

  RETURN jsonb_build_object('ok', true, 'credited', NOT already_credited);
END $function$;
