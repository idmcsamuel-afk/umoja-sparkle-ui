ALTER VIEW public.spark_exchange_mine SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.get_predictor_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_predictor_answer(uuid) TO authenticated;