CREATE OR REPLACE FUNCTION public.claim_signup_bonus()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE existing numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT balance INTO existing FROM public.spark_wallets WHERE member_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance, promotional_balance, promo_expires_at)
    VALUES (auth.uid(), 50, 50, now() + interval '90 days')
    ON CONFLICT (member_id) DO NOTHING;
  PERFORM set_config('app.allow_wallet_write', 'off', true);
  SELECT balance INTO existing FROM public.spark_wallets WHERE member_id = auth.uid();
  RETURN COALESCE(existing, 50);
END $$;