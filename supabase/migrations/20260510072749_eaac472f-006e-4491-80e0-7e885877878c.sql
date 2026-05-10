
-- Admins can view all wallets
CREATE POLICY wallets_admin_select ON public.spark_wallets
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Signup bonus: callable once per user; grants 100 sparks
CREATE OR REPLACE FUNCTION public.claim_signup_bonus()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE existing numeric; new_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT balance INTO existing FROM public.spark_wallets WHERE member_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance)
    VALUES (auth.uid(), 100)
    RETURNING balance INTO new_balance;
  PERFORM set_config('app.allow_wallet_write', 'off', true);
  RETURN new_balance;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_signup_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_bonus() TO authenticated;

-- Leaderboard: aggregated predictor stats (no per-entry exposure)
CREATE OR REPLACE FUNCTION public.predictor_leaderboard(_limit int DEFAULT 10)
RETURNS TABLE(member_id uuid, full_name text, correct bigint, sparks_won numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.member_id,
         COALESCE(m.full_name, 'Member') AS full_name,
         COUNT(*)::bigint AS correct,
         COALESCE(SUM(e.sparks_won), 0)::numeric AS sparks_won
    FROM public.predictor_entries e
    LEFT JOIN public.members m ON m.id = e.member_id
   WHERE e.is_correct = true
   GROUP BY e.member_id, m.full_name
   ORDER BY correct DESC, sparks_won DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
REVOKE EXECUTE ON FUNCTION public.predictor_leaderboard(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.predictor_leaderboard(int) TO authenticated;
