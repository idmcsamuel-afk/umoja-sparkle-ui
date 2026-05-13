CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT email INTO v_email FROM public.members WHERE id = _user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;

  -- Best-effort cleanup. Each DELETE is wrapped so a missing table doesn't abort.
  BEGIN DELETE FROM public.spark_transactions WHERE from_member = _user_id OR to_member = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.spark_wallets WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.circle_bids WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.drive_members WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.drive_notification_prefs WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.notifications WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fulfillment_applications WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.fulfillment_subscriptions WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.storefronts WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.predictor_entries WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.spark_trade_joins WHERE member_id = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE public.members SET referred_by = NULL WHERE referred_by = _user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.members WHERE id = _user_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'admin_delete_user', _user_id, jsonb_build_object('email', v_email));

  RETURN jsonb_build_object('ok', true, 'email', v_email);
END $$;