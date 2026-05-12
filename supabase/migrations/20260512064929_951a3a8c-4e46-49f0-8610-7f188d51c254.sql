ALTER TABLE public.spark_trade_shortlist
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS cost_updated_at timestamptz;