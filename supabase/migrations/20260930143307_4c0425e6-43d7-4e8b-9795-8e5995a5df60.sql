-- 1) members: replace table-wide read access for signed-in users with
--    column-level read access that excludes highly sensitive identifiers.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'members'
    AND column_name NOT IN ('id_number', 'paystack_customer_code', 'paystack_subscription_code');

  REVOKE SELECT ON public.members FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.members TO authenticated', cols);
END $$;

REVOKE SELECT ON public.members FROM anon;
GRANT ALL ON public.members TO service_role;

-- 2) spark_trade_subscriptions: drop denormalized contact columns (all NULL)
ALTER TABLE public.spark_trade_subscriptions
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS whatsapp;