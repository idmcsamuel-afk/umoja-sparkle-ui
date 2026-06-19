
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS spark_trade_subscription_tier text,
  ADD COLUMN IF NOT EXISTS spark_trade_subscription_payment_status text,
  ADD COLUMN IF NOT EXISTS spark_trade_subscription_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS spark_trade_paystack_reference text;

ALTER TABLE public.spark_trade_inventory_reservations
  ADD COLUMN IF NOT EXISTS payment_reference text;
