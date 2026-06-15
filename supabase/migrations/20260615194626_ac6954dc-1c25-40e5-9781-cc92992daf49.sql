-- Bug 2: allow 'referral' spark_type in game_results
ALTER TABLE public.game_results DROP CONSTRAINT IF EXISTS game_results_spark_type_check;
ALTER TABLE public.game_results ADD CONSTRAINT game_results_spark_type_check
  CHECK (spark_type = ANY (ARRAY['promotional','earned','purchased','referral']));

-- Bug 1: welcome bonus should land in promotional bucket so it counts toward total_playable
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
    VALUES (auth.uid(), 50, 50, now() + interval '90 days');
  PERFORM set_config('app.allow_wallet_write', 'off', true);
  RETURN 50;
END $$;