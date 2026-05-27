
-- Members: promotional unlock flags
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS promotional_sparks_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_unlock_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_unlock_circle_id uuid REFERENCES public.circle_bids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_unlock_bonus_sparks numeric NOT NULL DEFAULT 0;

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount_sparks numeric NOT NULL CHECK (amount_sparks > 0),
  amount_r_gross numeric NOT NULL,
  fee_charged numeric NOT NULL,
  amount_r_net numeric NOT NULL,
  spark_rate numeric NOT NULL DEFAULT 1.40,
  fee_rate numeric NOT NULL DEFAULT 0.05,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  branch_code text,
  status text NOT NULL DEFAULT 'pending',
  includes_promotional boolean NOT NULL DEFAULT false,
  promotional_amount numeric NOT NULL DEFAULT 0,
  unlock_via_circle uuid REFERENCES public.circle_bids(id) ON DELETE SET NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_member ON public.withdrawal_requests(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status, created_at DESC);

-- Bonus calculator
CREATE OR REPLACE FUNCTION public._promo_unlock_bonus(_fiat numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _fiat >= 1001 THEN 200
    WHEN _fiat >= 501 THEN 75
    WHEN _fiat >= 100 THEN 10
    WHEN _fiat >= 50 THEN 5
    ELSE 0
  END::numeric;
$$;

-- Trigger: when circle bid payment is confirmed, unlock promo sparks + award bonus (once)
CREATE OR REPLACE FUNCTION public._trg_promo_unlock_on_circle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.members%ROWTYPE;
  bonus numeric;
BEGIN
  IF NEW.payment_confirmed_at IS NULL OR OLD.payment_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.fiat_amount, 0) < 50 THEN RETURN NEW; END IF;

  SELECT * INTO m FROM public.members WHERE id = NEW.member_id;
  IF m.id IS NULL OR m.promotional_sparks_unlocked THEN RETURN NEW; END IF;

  bonus := public._promo_unlock_bonus(NEW.fiat_amount);

  UPDATE public.members
     SET promotional_sparks_unlocked = true,
         promo_unlock_at = now(),
         promo_unlock_circle_id = NEW.id,
         promo_unlock_bonus_sparks = bonus
   WHERE id = NEW.member_id;

  IF bonus > 0 THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    INSERT INTO public.spark_wallets (member_id, balance, earned_balance)
      VALUES (NEW.member_id, bonus, bonus)
      ON CONFLICT (member_id) DO UPDATE
        SET earned_balance = COALESCE(public.spark_wallets.earned_balance,0) + bonus,
            balance = COALESCE(public.spark_wallets.balance,0) + bonus,
            updated_at = now();
    PERFORM set_config('app.allow_wallet_write', 'off', true);
  END IF;

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (NEW.member_id, 'Promotional Sparks Unlocked ✨',
            'Your promo sparks are now withdrawable. Bonus: +' || bonus || ' earned sparks.',
            'sparks', '/withdraw');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_promo_unlock_on_circle ON public.circle_bids;
CREATE TRIGGER trg_promo_unlock_on_circle
  AFTER UPDATE OF payment_confirmed_at ON public.circle_bids
  FOR EACH ROW EXECUTE FUNCTION public._trg_promo_unlock_on_circle();

-- Generate reference like UMOJA-XXXXXXXX
CREATE OR REPLACE FUNCTION public._gen_withdrawal_ref()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
BEGIN
  LOOP
    result := 'UMOJA-';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE reference_number = result);
  END LOOP;
  RETURN result;
END $$;

-- Submit a withdrawal request
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  _amount_sparks numeric,
  _bank_name text,
  _account_number text,
  _account_holder text,
  _branch_code text DEFAULT NULL,
  _include_promotional boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m public.members%ROWTYPE;
  w public.spark_wallets%ROWTYPE;
  spark_rate numeric := 1.40;
  fee_rate numeric := 0.05;
  min_zar numeric := 500;
  min_sparks numeric;
  gross numeric; fee numeric; net numeric;
  withdrawable numeric;
  promo_used numeric := 0;
  remaining numeric;
  take numeric;
  ref text;
  rec_id uuid;
  daily_total numeric;
  daily_cap numeric := 500000;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  min_sparks := ceil(min_zar / spark_rate);

  SELECT * INTO m FROM public.members WHERE id = uid;
  IF m.id IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF COALESCE(m.kyc_level,0) < 1 THEN
    RETURN jsonb_build_object('ok',false,'reason','kyc_required');
  END IF;
  IF m.created_at > now() - interval '7 days' THEN
    RETURN jsonb_build_object('ok',false,'reason','account_too_new',
      'days_remaining', EXTRACT(DAY FROM (m.created_at + interval '7 days' - now()))::int);
  END IF;
  IF _amount_sparks < min_sparks THEN
    RETURN jsonb_build_object('ok',false,'reason','below_minimum','min_sparks',min_sparks);
  END IF;

  SELECT * INTO w FROM public.spark_wallets WHERE member_id = uid;
  IF w.member_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','no_wallet');
  END IF;

  withdrawable := COALESCE(w.earned_balance,0) + COALESCE(w.purchased_balance,0);
  IF _include_promotional AND m.promotional_sparks_unlocked THEN
    withdrawable := withdrawable + COALESCE(w.promotional_balance,0);
  END IF;

  IF _amount_sparks > withdrawable THEN
    RETURN jsonb_build_object('ok',false,'reason','insufficient_withdrawable','withdrawable',withdrawable);
  END IF;

  gross := round(_amount_sparks * spark_rate, 2);
  fee := round(gross * fee_rate, 2);
  net := gross - fee;

  -- Daily cap check (platform-wide)
  SELECT COALESCE(SUM(amount_r_net),0) INTO daily_total
    FROM public.withdrawal_requests
    WHERE created_at > now() - interval '24 hours'
      AND status IN ('pending','processing','completed');
  IF daily_total + net > daily_cap THEN
    RETURN jsonb_build_object('ok',false,'reason','daily_cap_reached');
  END IF;

  -- Deduct: earned -> purchased -> promo (if unlocked & included)
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  remaining := _amount_sparks;
  take := LEAST(remaining, COALESCE(w.earned_balance,0));
  UPDATE public.spark_wallets SET earned_balance = COALESCE(earned_balance,0) - take WHERE member_id = uid;
  remaining := remaining - take;

  IF remaining > 0 THEN
    take := LEAST(remaining, COALESCE(w.purchased_balance,0));
    UPDATE public.spark_wallets SET purchased_balance = COALESCE(purchased_balance,0) - take WHERE member_id = uid;
    remaining := remaining - take;
  END IF;

  IF remaining > 0 AND _include_promotional AND m.promotional_sparks_unlocked THEN
    take := LEAST(remaining, COALESCE(w.promotional_balance,0));
    UPDATE public.spark_wallets SET promotional_balance = COALESCE(promotional_balance,0) - take WHERE member_id = uid;
    promo_used := take;
    remaining := remaining - take;
  END IF;

  IF remaining > 0 THEN
    PERFORM set_config('app.allow_wallet_write', 'off', true);
    RAISE EXCEPTION 'balance_drift';
  END IF;

  UPDATE public.spark_wallets
     SET balance = COALESCE(earned_balance,0) + COALESCE(purchased_balance,0) + COALESCE(promotional_balance,0),
         updated_at = now()
   WHERE member_id = uid;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  ref := public._gen_withdrawal_ref();

  INSERT INTO public.withdrawal_requests (
    reference_number, member_id, amount_sparks, amount_r_gross, fee_charged, amount_r_net,
    spark_rate, fee_rate, bank_name, account_number, account_holder, branch_code,
    includes_promotional, promotional_amount, unlock_via_circle
  ) VALUES (
    ref, uid, _amount_sparks, gross, fee, net,
    spark_rate, fee_rate, _bank_name, _account_number, _account_holder, _branch_code,
    promo_used > 0, promo_used, m.promo_unlock_circle_id
  ) RETURNING id INTO rec_id;

  -- Save bank details on member if not set
  IF m.bank_name IS NULL OR m.bank_account IS NULL THEN
    UPDATE public.members SET bank_name = _bank_name, bank_account = _account_number,
      bank_branch = COALESCE(_branch_code, bank_branch)
    WHERE id = uid;
  END IF;

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (uid, 'Withdrawal submitted ✓',
            'R' || net || ' will be sent to your bank within 24–48 hours. Ref: ' || ref,
            'withdrawal', '/withdraw');

  RETURN jsonb_build_object('ok',true,'id',rec_id,'reference',ref,
    'amount_sparks',_amount_sparks,'gross',gross,'fee',fee,'net',net,
    'promotional_used',promo_used);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_withdrawal_request(numeric,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public._promo_unlock_bonus(numeric) TO authenticated;
