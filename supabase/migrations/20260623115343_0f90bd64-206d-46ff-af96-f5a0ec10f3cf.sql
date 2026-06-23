ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS trending_direction text DEFAULT 'up',
  ADD COLUMN IF NOT EXISTS stock_available integer DEFAULT 0;