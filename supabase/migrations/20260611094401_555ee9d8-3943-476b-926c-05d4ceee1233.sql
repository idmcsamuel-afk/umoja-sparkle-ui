CREATE OR REPLACE FUNCTION public.admin_revert_kyc(_member uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members
    SET kyc_level = 0,
        kyc_status = 'pending',
        kyc_verified_at = NULL,
        kyc_submitted_at = NULL,
        kyc_rejection_reason = _reason,
        kyc_override_reason = NULL,
        kyc_override_by = NULL,
        kyc_last_reminder_at = NULL,
        kyc_reminder_count = 0
  WHERE id = _member;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'kyc_revert', _member, jsonb_build_object('reason', _reason));
END $$;