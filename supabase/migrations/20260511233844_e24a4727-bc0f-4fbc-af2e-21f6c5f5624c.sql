
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS kyc_override_reason text,
  ADD COLUMN IF NOT EXISTS kyc_override_by uuid,
  ADD COLUMN IF NOT EXISTS kyc_last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reminder_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_member uuid, _override_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members
    SET kyc_level = 3,
        kyc_status = 'approved',
        kyc_verified_at = now(),
        kyc_rejection_reason = NULL,
        kyc_override_reason = _override_reason,
        kyc_override_by = CASE WHEN _override_reason IS NOT NULL THEN auth.uid() ELSE NULL END
  WHERE id = _member;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), CASE WHEN _override_reason IS NOT NULL THEN 'kyc_approve_override' ELSE 'kyc_approve' END,
            _member, jsonb_build_object('override_reason', _override_reason));

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'You''re verified ✅', 'KYC approved. Payouts are now unlocked.', 'kyc', '/profile');

  PERFORM public.award_kyc_referral_bonus(_member);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_record_kyc_reminder(_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE last_at timestamptz; cnt int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT kyc_last_reminder_at, kyc_reminder_count INTO last_at, cnt
    FROM public.members WHERE id = _member;
  IF last_at IS NOT NULL AND last_at > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'reminder already sent in the last 24 hours';
  END IF;
  UPDATE public.members
    SET kyc_last_reminder_at = now(),
        kyc_reminder_count = COALESCE(kyc_reminder_count,0) + 1
  WHERE id = _member
  RETURNING kyc_last_reminder_at, kyc_reminder_count INTO last_at, cnt;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'kyc_reminder', _member,
            jsonb_build_object('count', cnt, 'sent_at', last_at));
  RETURN jsonb_build_object('sent_at', last_at, 'count', cnt);
END $function$;
