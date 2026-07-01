
ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS freight_sea_zar numeric,
  ADD COLUMN IF NOT EXISTS freight_air_zar numeric,
  ADD COLUMN IF NOT EXISTS landed_cost_sea_zar numeric,
  ADD COLUMN IF NOT EXISTS landed_cost_air_zar numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_sea_zar numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_air_zar numeric,
  ADD COLUMN IF NOT EXISTS margin_sea_pct numeric,
  ADD COLUMN IF NOT EXISTS margin_air_pct numeric,
  ADD COLUMN IF NOT EXISTS air_available boolean NOT NULL DEFAULT true;

-- Backfill sea columns from existing single-mode fields for backward compatibility
UPDATE public.spark_trade_opportunities
SET
  freight_sea_zar        = COALESCE(freight_sea_zar, freight_cost_zar),
  landed_cost_sea_zar    = COALESCE(landed_cost_sea_zar, landed_cost_zar),
  gross_margin_sea_zar   = COALESCE(gross_margin_sea_zar, gross_margin_zar),
  margin_sea_pct         = COALESCE(margin_sea_pct, expected_margin_percentage)
WHERE freight_cost_zar IS NOT NULL
   OR landed_cost_zar IS NOT NULL
   OR gross_margin_zar IS NOT NULL
   OR expected_margin_percentage IS NOT NULL;
