
-- 1) Hide correct_answer column from anon/authenticated direct reads.
REVOKE SELECT ON public.predictor_questions FROM anon, authenticated;
GRANT SELECT (id, question, category, options, closes_at, sparks_cost, sparks_reward, status, created_at)
  ON public.predictor_questions TO anon, authenticated;

-- 2) Remove notifications table from realtime publication to prevent cross-user channel leakage.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications';
  END IF;
END $$;

-- 3) Tighten EXECUTE on SECURITY DEFINER functions: revoke from public/anon, keep authenticated where needed.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.predictor_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.predictor_leaderboard(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_signup_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_bonus() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.adjust_spark_balance(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_spark_balance(uuid, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_predictor_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_predictor_questions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_spark_trade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_spark_trade(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_ubuntu_fund(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_ubuntu_fund(numeric) TO authenticated;
