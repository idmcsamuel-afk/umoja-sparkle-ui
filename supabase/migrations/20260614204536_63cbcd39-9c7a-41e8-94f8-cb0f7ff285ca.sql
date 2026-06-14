
-- Spark Balance Consolidation & Referral Withdrawal Gate
-- (Retry: fulfillment_invoices uses total_amount, not amount_paid)

ALTER TABLE public.spark_wallets
  ADD COLUMN IF NOT EXISTS referral_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_sparks_withdrawn numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_spark_balance_total()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.balance := COALESCE(NEW.earned_balance,0)
               + COALESCE(NEW.purchased_balance,0)
               + COALESCE(NEW.promotional_balance,0)
               + COALESCE(NEW.referral_balance,0);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aa_spark_wallets_recompute_balance ON public.spark_wallets;
CREATE TRIGGER aa_spark_wallets_recompute_balance
  BEFORE INSERT OR UPDATE ON public.spark_wallets
  FOR EACH ROW EXECUTE FUNCTION public.recompute_spark_balance_total();

CREATE OR REPLACE FUNCTION public.protect_spark_wallet_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE expected numeric;
BEGIN
  IF current_setting('app.allow_wallet_write', true) = 'on' THEN RETURN NEW; END IF;
  expected := COALESCE(NEW.earned_balance,0)+COALESCE(NEW.purchased_balance,0)
            + COALESCE(NEW.promotional_balance,0)+COALESCE(NEW.referral_balance,0);
  IF NEW.balance = expected THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'spark_wallets.balance can only be modified by trusted server functions';
END $$;

-- Backfill: move unaccounted legacy balance into referral_balance (lossless)
UPDATE public.spark_wallets
   SET referral_balance = GREATEST(0,
        COALESCE(balance,0) - COALESCE(earned_balance,0)
      - COALESCE(purchased_balance,0) - COALESCE(promotional_balance,0))
 WHERE COALESCE(referral_balance,0) = 0
   AND COALESCE(balance,0) >
       COALESCE(earned_balance,0)+COALESCE(purchased_balance,0)+COALESCE(promotional_balance,0);

-- Referral credit functions → referral_balance bucket
CREATE OR REPLACE FUNCTION public.apply_referral_signup(_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  uid uuid := auth.uid();
  normalized_code text := upper(nullif(trim(COALESCE(_code, '')), ''));
  ref_member public.members%ROWTYPE; me public.members%ROWTYPE;
  already_credited boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF normalized_code IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','no_code'); END IF;
  SELECT * INTO me FROM public.members WHERE id = uid;
  IF me.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','member_not_found'); END IF;
  SELECT * INTO ref_member FROM public.members WHERE referral_code = normalized_code;
  IF ref_member.id IS NULL OR ref_member.id = uid THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_code');
  END IF;
  IF (me.referred_by IS NOT NULL AND me.referred_by <> ref_member.id)
     OR (me.referred_by_code IS NOT NULL AND me.referred_by_code <> normalized_code) THEN
    RETURN jsonb_build_object('ok',false,'reason','already_referred');
  END IF;
  IF me.referred_by IS NULL OR me.referred_by_code IS NULL THEN
    PERFORM set_config('app.allow_referral_link_write','on',true);
    UPDATE public.members SET referred_by_code = normalized_code, referred_by = ref_member.id
     WHERE id = uid AND referred_by IS NULL AND referred_by_code IS NULL;
    PERFORM set_config('app.allow_referral_link_write','off',true);
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.spark_transactions
    WHERE from_member=uid AND to_member=ref_member.id AND tx_type='referral_signup')
    INTO already_credited;
  IF NOT already_credited THEN
    INSERT INTO public.spark_wallets (member_id, referral_balance)
      VALUES (ref_member.id, 100)
      ON CONFLICT (member_id) DO UPDATE
        SET referral_balance = public.spark_wallets.referral_balance + 100, updated_at = now();
    INSERT INTO public.spark_transactions (from_member,to_member,amount,tx_type,status)
      VALUES (uid, ref_member.id, 100, 'referral_signup', 'completed');
    INSERT INTO public.notifications (member_id,title,body,kind,link)
      VALUES (ref_member.id,'You earned 100 Sparks ✨',
              COALESCE(me.full_name,'A new member')||' joined using your referral link.',
              'referral','/referrals');
  END IF;
  RETURN jsonb_build_object('ok',true,
    'reason', CASE WHEN already_credited THEN 'already_credited' ELSE 'credited' END,
    'referrer_name', ref_member.full_name, 'referrer_id', ref_member.id);
END $function$;

CREATE OR REPLACE FUNCTION public.award_kyc_referral_bonus(_member uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE target uuid := COALESCE(_member, auth.uid());
        m public.members%ROWTYPE; ref_member public.members%ROWTYPE;
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
  INSERT INTO public.spark_wallets (member_id, referral_balance)
    VALUES (ref_member.id, 30)
    ON CONFLICT (member_id) DO UPDATE
      SET referral_balance = public.spark_wallets.referral_balance + 30, updated_at = now();
  UPDATE public.members SET kyc_referral_bonus_paid = true WHERE id = target;
  INSERT INTO public.spark_transactions (from_member,to_member,amount,tx_type,status)
    VALUES (target, ref_member.id, 30, 'referral_kyc_bonus', 'completed');
  INSERT INTO public.notifications (member_id,title,body,kind,link)
    VALUES (ref_member.id,'KYC referral bonus +30 Sparks 🎉',
            COALESCE(m.full_name,'Your referred member')||' completed verification.',
            'referral','/referrals');
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_award_referral_bonus(_member uuid, _amount numeric, _note text DEFAULT NULL::text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  INSERT INTO public.spark_wallets (member_id, referral_balance)
    VALUES (_member, _amount)
    ON CONFLICT (member_id) DO UPDATE
      SET referral_balance = public.spark_wallets.referral_balance + _amount, updated_at = now()
    RETURNING balance INTO new_balance;
  INSERT INTO public.spark_transactions (from_member,to_member,amount,tx_type,status)
    VALUES (_member, _member, _amount, 'referral_admin_bonus', 'completed');
  INSERT INTO public.notifications (member_id,title,body,kind,link)
    VALUES (_member,'Bonus Sparks awarded 🎁',
            COALESCE(_note,'Admin awarded you a referral bonus.'),'referral','/referrals');
  RETURN new_balance;
END $function$;

-- Qualifying contribution + releasable referral
CREATE OR REPLACE FUNCTION public.qualifying_contribution_zar(_member uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT SUM(COALESCE(fiat_amount, net_amount, 0))
              FROM public.circle_bids
              WHERE member_id = _member
                AND status IN ('paid','vault','overdue','completed')), 0)
  + COALESCE((SELECT SUM(amount) FROM public.drive_contributions
              WHERE member_id = _member AND status = 'completed'), 0)
  + COALESCE((SELECT SUM(order_total) FROM public.st_orders
              WHERE member_id = _member AND status IN ('paid','completed')), 0)
  + COALESCE((SELECT SUM(total_amount) FROM public.fulfillment_invoices
              WHERE member_id = _member AND status = 'paid'), 0);
$$;

CREATE OR REPLACE FUNCTION public.releasable_referral_sparks(_member uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (
    SELECT COALESCE(referral_balance,0) AS bal,
           COALESCE(referral_sparks_withdrawn,0) AS used
      FROM public.spark_wallets WHERE member_id = _member
  )
  SELECT LEAST(
    GREATEST( floor(public.qualifying_contribution_zar(_member) / 1.5) - w.used, 0 ),
    w.bal
  ) FROM w;
$$;

-- Canonical spark balance breakdown (4 buckets + derived)
CREATE OR REPLACE FUNCTION public.spark_balance_breakdown(_member uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  target uuid := COALESCE(_member, auth.uid());
  w public.spark_wallets%ROWTYPE; m public.members%ROWTYPE;
  promo_active numeric; ref_releasable numeric;
  total_playable numeric; total_withdrawable numeric; ref_locked numeric;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _member IS NOT NULL AND _member <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO w FROM public.spark_wallets WHERE member_id = target;
  SELECT * INTO m FROM public.members WHERE id = target;
  IF w.member_id IS NULL THEN
    RETURN jsonb_build_object(
      'promotional',0,'earned',0,'purchased',0,'referral',0,
      'total',0,'total_playable',0,'withdrawable',0,'total_withdrawable',0,
      'referral_releasable',0,'referral_locked',0,'referral_sparks_withdrawn',0,
      'promo_expires_at',null,'zar_value',0,'has_contributed',false,
      'qualifying_contribution_zar',0);
  END IF;
  promo_active := CASE WHEN w.promo_expires_at IS NOT NULL AND w.promo_expires_at < now() THEN 0
                       ELSE COALESCE(w.promotional_balance,0) END;
  ref_releasable := public.releasable_referral_sparks(target);
  ref_locked := COALESCE(w.referral_balance,0) - ref_releasable;
  total_playable := promo_active + COALESCE(w.earned_balance,0)
                  + COALESCE(w.purchased_balance,0) + COALESCE(w.referral_balance,0);
  total_withdrawable := COALESCE(w.purchased_balance,0)
                      + CASE WHEN COALESCE(m.has_contributed,false) THEN COALESCE(w.earned_balance,0) ELSE 0 END
                      + ref_releasable;
  RETURN jsonb_build_object(
    'promotional', COALESCE(w.promotional_balance,0),
    'earned', COALESCE(w.earned_balance,0),
    'purchased', COALESCE(w.purchased_balance,0),
    'referral', COALESCE(w.referral_balance,0),
    'total', total_playable,
    'total_playable', total_playable,
    'withdrawable', total_withdrawable,
    'total_withdrawable', total_withdrawable,
    'referral_releasable', ref_releasable,
    'referral_locked', ref_locked,
    'referral_sparks_withdrawn', COALESCE(w.referral_sparks_withdrawn,0),
    'promo_expires_at', w.promo_expires_at,
    'zar_value', ROUND(total_playable * 1.40, 2),
    'has_contributed', COALESCE(m.has_contributed,false),
    'qualifying_contribution_zar', public.qualifying_contribution_zar(target));
END $function$;

-- Spark Flip: accept 'referral' spark type
CREATE OR REPLACE FUNCTION public.apply_spark_flip_outcome(_spark_type text, _bet numeric, _choice text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE uid uuid := auth.uid(); w public.spark_wallets%ROWTYPE;
        win_prob numeric; won boolean; result text; payout numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _spark_type NOT IN ('promotional','earned','purchased','referral') THEN RAISE EXCEPTION 'invalid spark_type'; END IF;
  IF _bet <= 0 THEN RAISE EXCEPTION 'invalid bet'; END IF;
  IF _choice NOT IN ('heads','tails') THEN RAISE EXCEPTION 'invalid choice'; END IF;
  SELECT * INTO w FROM public.spark_wallets WHERE member_id = uid FOR UPDATE;
  IF w.member_id IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF _spark_type='promotional' AND w.promotional_balance < _bet THEN RAISE EXCEPTION 'insufficient promotional sparks'; END IF;
  IF _spark_type='earned'      AND w.earned_balance      < _bet THEN RAISE EXCEPTION 'insufficient earned sparks'; END IF;
  IF _spark_type='purchased'   AND w.purchased_balance   < _bet THEN RAISE EXCEPTION 'insufficient purchased sparks'; END IF;
  IF _spark_type='referral'    AND w.referral_balance    < _bet THEN RAISE EXCEPTION 'insufficient referral sparks'; END IF;
  IF _spark_type='promotional' AND w.promo_expires_at IS NOT NULL AND w.promo_expires_at < now() THEN
    UPDATE public.spark_wallets SET promotional_balance = 0, updated_at = now() WHERE member_id = uid;
    RAISE EXCEPTION 'promotional sparks expired';
  END IF;
  win_prob := CASE WHEN _spark_type='promotional' THEN 0.30 ELSE 0.45 END;
  won := random() < win_prob;
  result := CASE WHEN won THEN _choice ELSE CASE WHEN _choice='heads' THEN 'tails' ELSE 'heads' END END;
  IF won THEN
    payout := _bet * 2;
    UPDATE public.spark_wallets SET
      promotional_balance = promotional_balance - CASE WHEN _spark_type='promotional' THEN _bet ELSE 0 END,
      earned_balance      = earned_balance      - CASE WHEN _spark_type='earned'      THEN _bet ELSE 0 END + payout,
      purchased_balance   = purchased_balance   - CASE WHEN _spark_type='purchased'   THEN _bet ELSE 0 END,
      referral_balance    = referral_balance    - CASE WHEN _spark_type='referral'    THEN _bet ELSE 0 END,
      updated_at = now() WHERE member_id = uid;
  ELSE
    UPDATE public.spark_wallets SET
      promotional_balance = promotional_balance - CASE WHEN _spark_type='promotional' THEN _bet ELSE 0 END,
      earned_balance      = earned_balance      - CASE WHEN _spark_type='earned'      THEN _bet ELSE 0 END,
      purchased_balance   = purchased_balance   - CASE WHEN _spark_type='purchased'   THEN _bet ELSE 0 END,
      referral_balance    = referral_balance    - CASE WHEN _spark_type='referral'    THEN _bet ELSE 0 END,
      updated_at = now() WHERE member_id = uid;
  END IF;
  INSERT INTO public.game_results (member_id, game_type, spark_type, bet_amount, won_amount, outcome)
    VALUES (uid, 'spark_flip', _spark_type, _bet, payout, CASE WHEN won THEN 'win' ELSE 'lose' END);
  INSERT INTO public.spark_flip_games (member_id, choice, result, payout, bet_sparks)
    VALUES (uid, _choice, result, payout, _bet);
  RETURN jsonb_build_object('ok',true,'won',won,'result',result,'payout',payout,'win_prob',win_prob);
END $function$;

-- Withdrawal flow: gate referral via releasable, increment consumption tracker
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  _amount_sparks numeric, _bank_name text, _account_number text,
  _account_holder text, _branch_code text DEFAULT NULL::text,
  _include_promotional boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  uid uuid := auth.uid(); m public.members%ROWTYPE; w public.spark_wallets%ROWTYPE;
  spark_rate numeric := 1.40; fee_rate numeric := 0.05; min_zar numeric := 500;
  min_sparks numeric; gross numeric; fee numeric; net numeric;
  withdrawable numeric; ref_release numeric;
  promo_used numeric := 0; ref_used numeric := 0;
  remaining numeric; take numeric; ref text; rec_id uuid;
  daily_total numeric; daily_cap numeric := 500000;
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
    RETURN jsonb_build_object('ok',false,'reason','insufficient_withdrawable','withdrawable',withdrawable);
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
