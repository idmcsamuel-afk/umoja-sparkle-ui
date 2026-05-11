ALTER TABLE public.spark_trade_shortlist
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS spark_trade_shortlist_data_source_idx
  ON public.spark_trade_shortlist (data_source);