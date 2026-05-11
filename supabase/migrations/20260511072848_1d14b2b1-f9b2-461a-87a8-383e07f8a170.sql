
-- 1. Columns
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_code text,
  ADD COLUMN IF NOT EXISTS kyc_referral_bonus_paid boolean NOT NULL DEFAULT false;

-- 2. Code generator
CREATE OR REPLACE FUNCTION public.gen_referral_code(_seed text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.members WHERE referral_code = result);
    attempts := attempts + 1;
    IF attempts > 10 THEN EXIT; END IF;
  END LOOP;
  RETURN result;
END $$;

-- 3. Backfill existing members
UPDATE public.members
   SET referral_code = public.gen_referral_code(full_name)
 WHERE referral_code IS NULL;

-- 4. Trigger to auto-generate on insert
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.gen_referral_code(NEW.full_name);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS members_set_referral_code ON public.members;
CREATE TRIGGER members_set_referral_code
BEFORE INSERT ON public.members
FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- 5. Apply referral at signup (called by new member)
CREATE OR REPLACE FUNCTION public.apply_referral_signup(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Award referrer 200 sparks
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (ref_member.id, 200)
    ON CONFLICT (member_id) DO UPDATE
      SET balance = public.spark_wallets.balance + 200,
          updated_at = now();
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
    VALUES (uid, ref_member.id, 200, 'referral_signup', 'completed');

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (ref_member.id, 'You earned 200 Sparks ✨',
            COALESCE(me.full_name, 'A new member') || ' joined using your referral link.',
            'referral', '/referrals');

  RETURN jsonb_build_object(
    'ok', true,
    'referrer_name', ref_member.full_name,
    'referrer_id', ref_member.id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.apply_referral_signup(text) TO authenticated;

-- 6. KYC bonus (call from client when own kyc_level reaches 3, or from admin approval)
CREATE OR REPLACE FUNCTION public.award_kyc_referral_bonus(_member uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    VALUES (ref_member.id, 300)
    ON CONFLICT (member_id) DO UPDATE
      SET balance = public.spark_wallets.balance + 300,
          updated_at = now();
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  UPDATE public.members SET kyc_referral_bonus_paid = true WHERE id = target;

  INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
    VALUES (target, ref_member.id, 300, 'referral_kyc_bonus', 'completed');

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (ref_member.id, 'KYC referral bonus +300 Sparks 🎉',
            COALESCE(m.full_name, 'Your referred member') || ' completed verification.',
            'referral', '/referrals');

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.award_kyc_referral_bonus(uuid) TO authenticated;

-- 7. Stats + leaderboard
CREATE OR REPLACE FUNCTION public.referral_stats(_member uuid DEFAULT NULL)
RETURNS TABLE(total_refs bigint, sparks_earned numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*) FROM public.members WHERE referred_by = COALESCE(_member, auth.uid())),
    COALESCE((SELECT SUM(amount) FROM public.spark_transactions
               WHERE to_member = COALESCE(_member, auth.uid())
                 AND tx_type IN ('referral_signup','referral_kyc_bonus')), 0);
$$;
GRANT EXECUTE ON FUNCTION public.referral_stats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.referral_leaderboard(_limit int DEFAULT 10)
RETURNS TABLE(member_id uuid, full_name text, referral_code text, total_refs bigint, sparks_earned numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id,
         COALESCE(m.full_name,'Member') AS full_name,
         m.referral_code,
         COUNT(r.id)::bigint AS total_refs,
         COALESCE((SELECT SUM(amount) FROM public.spark_transactions
                    WHERE to_member = m.id
                      AND tx_type IN ('referral_signup','referral_kyc_bonus')), 0) AS sparks_earned
    FROM public.members m
    LEFT JOIN public.members r ON r.referred_by = m.id
   GROUP BY m.id, m.full_name, m.referral_code
   HAVING COUNT(r.id) > 0
   ORDER BY total_refs DESC, sparks_earned DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.referral_leaderboard(int) TO authenticated;

-- 8. List my referred members
CREATE OR REPLACE FUNCTION public.my_referred_members()
RETURNS TABLE(id uuid, full_name text, joined_at timestamptz, kyc_level int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, full_name, created_at, kyc_level
    FROM public.members
   WHERE referred_by = auth.uid()
   ORDER BY created_at DESC
   LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.my_referred_members() TO authenticated;

-- 9. Admin analytics
CREATE OR REPLACE FUNCTION public.admin_referral_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_refs bigint;
  total_sparks numeric;
  total_signups bigint;
  conv_rate numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO total_refs FROM public.members WHERE referred_by IS NOT NULL;
  SELECT COUNT(*) INTO total_signups FROM public.members;
  SELECT COALESCE(SUM(amount),0) INTO total_sparks
    FROM public.spark_transactions
   WHERE tx_type IN ('referral_signup','referral_kyc_bonus');
  conv_rate := CASE WHEN total_signups > 0
                    THEN ROUND((total_refs::numeric / total_signups) * 100, 2)
                    ELSE 0 END;
  RETURN jsonb_build_object(
    'total_referrals', total_refs,
    'total_signups', total_signups,
    'conversion_rate_pct', conv_rate,
    'total_sparks_awarded', total_sparks
  );
END $$;
GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_top_referrers_month(_limit int DEFAULT 10)
RETURNS TABLE(member_id uuid, full_name text, refs_this_month bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, COALESCE(m.full_name,'Member'),
         COUNT(r.id)::bigint
    FROM public.members m
    JOIN public.members r ON r.referred_by = m.id
   WHERE r.created_at >= date_trunc('month', now())
     AND public.is_admin(auth.uid())
   GROUP BY m.id, m.full_name
   ORDER BY 3 DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.admin_top_referrers_month(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_award_referral_bonus(_member uuid, _amount numeric, _note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (_member, _amount)
    ON CONFLICT (member_id) DO UPDATE
      SET balance = public.spark_wallets.balance + _amount,
          updated_at = now()
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_transactions (from_member, to_member, amount, tx_type, status)
    VALUES (_member, _member, _amount, 'referral_admin_bonus', 'completed');

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Bonus Sparks awarded 🎁',
            COALESCE(_note, 'Admin awarded you a referral bonus.'),
            'referral', '/referrals');
  RETURN new_balance;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_award_referral_bonus(uuid, numeric, text) TO authenticated;

-- 10. Allow public to look up referrer name from a code (for signup landing)
CREATE OR REPLACE FUNCTION public.lookup_referrer(_code text)
RETURNS TABLE(full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT full_name FROM public.members WHERE referral_code = upper(_code) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_referrer(text) TO anon, authenticated;
