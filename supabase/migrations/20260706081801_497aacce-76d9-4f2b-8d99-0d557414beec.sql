
-- Server-callable spark-purchase crediting (used by verify-paystack-payment).
-- Mirrors public.apply_spark_purchase but skips the auth.uid() check because it
-- is only granted to service_role (edge functions running with SUPABASE_SERVICE_ROLE_KEY).
CREATE OR REPLACE FUNCTION public.credit_spark_purchase_srv(
  _member uuid,
  _sparks integer,
  _bonus integer,
  _amount_paid numeric,
  _reference text,
  _email text,
  _phone text,
  _tier text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_add integer := _sparks + COALESCE(_bonus,0);
  new_purchased numeric;
BEGIN
  IF total_add <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _member IS NULL THEN RAISE EXCEPTION 'member required'; END IF;

  IF EXISTS (SELECT 1 FROM public.spark_purchases WHERE payment_reference = _reference AND status = 'completed') THEN
    SELECT purchased_balance INTO new_purchased FROM public.spark_wallets WHERE member_id = _member;
    RETURN jsonb_build_object('ok', true, 'already_applied', true, 'purchased_balance', new_purchased);
  END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);
  INSERT INTO public.spark_wallets (member_id, balance, purchased_balance)
    VALUES (_member, total_add, total_add)
    ON CONFLICT (member_id) DO UPDATE
      SET purchased_balance = public.spark_wallets.purchased_balance + total_add,
          balance = public.spark_wallets.balance + total_add,
          updated_at = now()
    RETURNING purchased_balance INTO new_purchased;
  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_purchases (member_id, email, phone, tier, amount_paid, sparks_added, bonus_sparks, payment_reference, status)
    VALUES (_member, _email, _phone, _tier, _amount_paid, _sparks, COALESCE(_bonus,0), _reference, 'completed')
    ON CONFLICT (payment_reference) DO UPDATE SET status = 'completed';

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Sparks added ✨', '+' || total_add || ' Sparks credited to your wallet.', 'sparks', '/spark-pit');

  RETURN jsonb_build_object('ok', true, 'purchased_balance', new_purchased, 'added', total_add);
END $function$;

REVOKE EXECUTE ON FUNCTION public.credit_spark_purchase_srv(uuid, integer, integer, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_spark_purchase_srv(uuid, integer, integer, numeric, text, text, text, text) TO service_role;

-- Back-credit the R99 live payment that was received but never routed.
SELECT public.credit_spark_purchase_srv(
  '12469fec-57da-41b8-8a40-2c9610bfbc21'::uuid,
  50, 0, 99,
  'ST-ENTRY-12469FEC-1783325422502',
  'idmcsamuel@gmail.com',
  '',
  'entry'
);
