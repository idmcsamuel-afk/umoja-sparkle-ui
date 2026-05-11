CREATE UNIQUE INDEX IF NOT EXISTS spark_trade_shortlist_asin_unique
  ON public.spark_trade_shortlist (asin);