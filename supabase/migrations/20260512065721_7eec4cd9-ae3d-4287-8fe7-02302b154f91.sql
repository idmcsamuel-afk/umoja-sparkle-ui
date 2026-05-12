ALTER TABLE public.members DISABLE TRIGGER USER;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_kyc_status_check;
UPDATE public.members SET kyc_status = 'approved' WHERE kyc_status = 'verified';
UPDATE public.members SET kyc_status = 'rejected' WHERE kyc_status = 'failed';
ALTER TABLE public.members
  ADD CONSTRAINT members_kyc_status_check
  CHECK (kyc_status IN ('pending','under_review','approved','rejected','incomplete'));
ALTER TABLE public.members ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.admin_adjust_sparks(_member uuid, _delta numeric, _reason text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason required'; END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (_member, GREATEST(0, _delta))
    ON CONFLICT (member_id) DO UPDATE
      SET balance = GREATEST(0, public.spark_wallets.balance + _delta),
          updated_at = now()
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  IF _delta > 0 THEN
    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
      VALUES (NULL, _member, _delta, 'admin_adjustment', 'completed', _reason);
  ELSE
    INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status, description)
      VALUES (_member, NULL, abs(_delta), 'admin_adjustment', 'completed', _reason);
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'adjust_sparks', _member,
            jsonb_build_object('delta', _delta, 'reason', _reason, 'new_balance', new_balance));

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member,
            CASE WHEN _delta > 0 THEN 'Sparks added ✨' ELSE 'Sparks adjusted' END,
            CASE WHEN _delta > 0
                 THEN '+' || _delta || ' Sparks: ' || _reason
                 ELSE _delta || ' Sparks: ' || _reason END,
            'admin', '/dashboard');

  RETURN new_balance;
END $function$;