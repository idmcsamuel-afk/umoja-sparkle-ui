
-- 1. Hide predictor.correct_answer from non-admins via column privilege
REVOKE SELECT (correct_answer) ON public.predictor_questions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_predictor_questions()
RETURNS SETOF public.predictor_questions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.predictor_questions ORDER BY created_at DESC LIMIT 200;
END$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_predictor_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_predictor_questions() TO authenticated;

-- 2. predictor_entries: own rows only
DROP POLICY IF EXISTS predictor_entries_select ON public.predictor_entries;
CREATE POLICY predictor_entries_select ON public.predictor_entries
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

-- 3. drive_circles: safe defaults on insert; admin-only update
DROP POLICY IF EXISTS drive_circles_insert ON public.drive_circles;
DROP POLICY IF EXISTS drive_circles_update ON public.drive_circles;
CREATE POLICY drive_circles_insert ON public.drive_circles
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(status, 'forming') = 'forming'
    AND COALESCE(current_pool, 0) = 0
    AND COALESCE(members_count, 0) = 0
    AND winner_id IS NULL
  );
CREATE POLICY drive_circles_admin_update ON public.drive_circles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. drive_members: own rows only (admins via is_admin)
DROP POLICY IF EXISTS drive_members_select ON public.drive_members;
CREATE POLICY drive_members_select ON public.drive_members
  FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));

-- 5. admin_users: only self-row, plus admins see all
DROP POLICY IF EXISTS admin_read ON public.admin_users;
CREATE POLICY admin_read_self ON public.admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY admin_read_all_for_admins ON public.admin_users
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 6. spark_exchange: require sign-in
DROP POLICY IF EXISTS exchange_select ON public.spark_exchange;
CREATE POLICY exchange_select ON public.spark_exchange
  FOR SELECT TO authenticated USING (true);

-- 7. st_products: require sign-in (hides supplier costs from anon)
DROP POLICY IF EXISTS st_products_select ON public.st_products;
CREATE POLICY st_products_select ON public.st_products
  FOR SELECT TO authenticated USING (COALESCE(is_active, true));
REVOKE SELECT ON public.st_products FROM anon;

-- 8. members: drop is_admin column (admin status lives in admin_users) and attach
--    the existing protect_privileged_member_fields trigger so users cannot
--    escalate kyc_status/rank/referred_by on themselves.
ALTER TABLE public.members DROP COLUMN IF EXISTS is_admin;

CREATE OR REPLACE FUNCTION public.protect_privileged_member_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.kyc_status := OLD.kyc_status;
  NEW.rank := OLD.rank;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS members_protect_privileged ON public.members;
CREATE TRIGGER members_protect_privileged
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_member_fields();

-- 9. spark_wallets: stop direct balance writes; users may only insert/read own row
DROP POLICY IF EXISTS wallets_all ON public.spark_wallets;
CREATE POLICY wallets_select ON public.spark_wallets
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY wallets_insert ON public.spark_wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id AND COALESCE(balance, 0) = 0);

CREATE OR REPLACE FUNCTION public.protect_spark_wallet_balance()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_wallet_write', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'spark_wallets.balance can only be modified by trusted server functions';
END $$;
ALTER FUNCTION public.protect_spark_wallet_balance() SET search_path = public;

DROP TRIGGER IF EXISTS spark_wallets_balance_guard ON public.spark_wallets;
CREATE TRIGGER spark_wallets_balance_guard
  BEFORE UPDATE OF balance ON public.spark_wallets
  FOR EACH ROW
  WHEN (NEW.balance IS DISTINCT FROM OLD.balance)
  EXECUTE FUNCTION public.protect_spark_wallet_balance();

-- Trusted RPCs to mutate balances (single entrypoints)
CREATE OR REPLACE FUNCTION public.adjust_spark_balance(_member uuid, _delta numeric, _note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_balance numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (_member, GREATEST(0, _delta))
    ON CONFLICT (member_id) DO UPDATE
      SET balance = GREATEST(0, public.spark_wallets.balance + _delta),
          updated_at = now()
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);
  RETURN new_balance;
END $$;
REVOKE EXECUTE ON FUNCTION public.adjust_spark_balance(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_spark_balance(uuid, numeric, text) TO authenticated;

-- 10. Function search_path hardening
CREATE OR REPLACE FUNCTION public.touch_drive_notification_prefs()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;

-- 11. Restrict EXECUTE on SECURITY DEFINER helper functions
REVOKE EXECUTE ON FUNCTION public.join_spark_trade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_spark_trade(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_ubuntu_fund(numeric) FROM PUBLIC, anon, authenticated;
