CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(_amount_sparks numeric, _bank_name text, _account_number text, _account_holder text, _branch_code text DEFAULT NULL::text, _include_promotional boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); m public.members%ROWTYPE; w public.spark_wallets%ROWTYPE;
  spark_rate numeric := 1.40; fee_rate numeric := 0.05; min_zar numeric := 500;
  min_sparks numeric; gross numeric; fee numeric; net numeric;
  withdrawable numeric; ref_release numeric;
  promo_used numeric := 0; ref_used numeric := 0;
  remaining numeric; take numeric; ref text; rec_id uuid;
  daily_total numeric; daily_cap numeric := 500000;
  pending_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  min_sparks := ceil(min_zar / spark_rate);
  SELECT * INTO m FROM public.members WHERE id = uid;
  IF m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF COALESCE(m.kyc_level,0) < 1 THEN RETURN jsonb_build_object('ok',false,'reason','kyc_required'); END IF;
  IF m.created_at > now() - interval '7 days' THEN
    RETURN jsonb_build_object('ok',false,'reason','account_too_new',
      'days_remaining', EXTRACT(DAY FROM (m.created_at + interval '7 days' - now()))::int);
  END IF;

  -- Block duplicate pending/processing requests
  SELECT COUNT(*) INTO pending_count FROM public.withdrawal_requests
   WHERE member_id = uid AND status IN ('pending','processing');
  IF pending_count > 0 THEN
    RETURN jsonb_build_object('ok',false,'reason','pending_request_exists',
      'message','You already have a pending withdrawal. Wait for it to be processed before submitting another.');
  END IF;

  IF _amount_sparks < min_sparks THEN
    RETURN jsonb_build_object('ok',false,'reason','below_minimum','min_sparks',min_sparks);
  END IF;
  SELECT * INTO w FROM public.spark_wallets WHERE member_id = uid FOR UPDATE;
  IF w.member_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','no_wallet'); END IF;
  ref_release := public.releasable_referral_sparks(uid);
  withdrawable := COALESCE(w.purchased_balance,0)
                + CASE WHEN COALESCE(m.has_contributed,false) THEN COALESCE(w.earned_balance,0) ELSE 0 END
                + ref_release;
  IF _include_promotional AND m.promotional_sparks_unlocked THEN
    withdrawable := withdrawable + COALESCE(w.promotional_balance,0);
  END IF;
  IF _amount_sparks > withdrawable THEN
    RETURN jsonb_build_object('ok',false,'reason','insufficient_withdrawable',
      'withdrawable',withdrawable,
      'releasable_referral',ref_release,
      'message', 'You can only withdraw '||withdrawable||' sparks right now. Referral sparks require KYC-verified referrals and a qualifying own contribution before they can be released.');
  END IF;
  gross := round(_amount_sparks * spark_rate, 2);
  fee   := round(gross * fee_rate, 2);
  net   := gross - fee;
  SELECT COALESCE(SUM(amount_r_net),0) INTO daily_total FROM public.withdrawal_requests
   WHERE created_at > now() - interval '24 hours' AND status IN ('pending','processing','completed');
  IF daily_total + net > daily_cap THEN
    RETURN jsonb_build_object('ok',false,'reason','daily_cap_reached');
  END IF;
  remaining := _amount_sparks;
  take := LEAST(remaining, COALESCE(w.purchased_balance,0));
  IF take > 0 THEN
    UPDATE public.spark_wallets SET purchased_balance = purchased_balance - take WHERE member_id = uid;
    remaining := remaining - take;
  END IF;
  IF remaining > 0 AND COALESCE(m.has_contributed,false) THEN
    take := LEAST(remaining, COALESCE(w.earned_balance,0));
    IF take > 0 THEN
      UPDATE public.spark_wallets SET earned_balance = earned_balance - take WHERE member_id = uid;
      remaining := remaining - take;
    END IF;
  END IF;
  IF remaining > 0 AND ref_release > 0 THEN
    take := LEAST(remaining, ref_release);
    IF take > 0 THEN
      UPDATE public.spark_wallets
        SET referral_balance = referral_balance - take,
            referral_sparks_withdrawn = referral_sparks_withdrawn + take
        WHERE member_id = uid;
      ref_used := take; remaining := remaining - take;
    END IF;
  END IF;
  IF remaining > 0 AND _include_promotional AND m.promotional_sparks_unlocked THEN
    take := LEAST(remaining, COALESCE(w.promotional_balance,0));
    IF take > 0 THEN
      UPDATE public.spark_wallets SET promotional_balance = promotional_balance - take WHERE member_id = uid;
      promo_used := take; remaining := remaining - take;
    END IF;
  END IF;
  IF remaining > 0 THEN RAISE EXCEPTION 'balance_drift'; END IF;
  UPDATE public.spark_wallets SET updated_at = now() WHERE member_id = uid;
  ref := public._gen_withdrawal_ref();
  INSERT INTO public.withdrawal_requests (
    reference_number, member_id, amount_sparks, amount_r_gross, fee_charged, amount_r_net,
    spark_rate, fee_rate, bank_name, account_number, account_holder, branch_code,
    includes_promotional, promotional_amount, unlock_via_circle)
  VALUES (ref, uid, _amount_sparks, gross, fee, net, spark_rate, fee_rate,
    _bank_name, _account_number, _account_holder, _branch_code,
    promo_used > 0, promo_used, m.promo_unlock_circle_id) RETURNING id INTO rec_id;
  IF m.bank_name IS NULL OR m.bank_account IS NULL THEN
    UPDATE public.members SET bank_name = _bank_name, bank_account = _account_number,
      bank_branch = COALESCE(_branch_code, bank_branch) WHERE id = uid;
  END IF;
  INSERT INTO public.notifications (member_id,title,body,kind,link)
    VALUES (uid,'Withdrawal submitted ✓',
            'R'||net||' will be sent to your bank within 24–48 hours. Ref: '||ref,
            'withdrawal','/withdraw');
  RETURN jsonb_build_object('ok',true,'id',rec_id,'reference',ref,
    'amount_sparks',_amount_sparks,'gross',gross,'fee',fee,'net',net,
    'promotional_used',promo_used,'referral_used',ref_used);
END $function$;