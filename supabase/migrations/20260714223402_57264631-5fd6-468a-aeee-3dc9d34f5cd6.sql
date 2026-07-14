
ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS freight_rate_per_cbm numeric NOT NULL DEFAULT 8800,
  ADD COLUMN IF NOT EXISTS freight_density_kg_per_cbm numeric NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS cbm_per_unit numeric,
  ADD COLUMN IF NOT EXISTS freight_uses_weight_estimate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dimensions_flagged boolean NOT NULL DEFAULT false;

-- Backfill freight using weight-estimate default (weight/200 * 8800), preserving overrides.
WITH calc AS (
  SELECT
    id,
    COALESCE(alibaba_cost_zar,0) AS alibaba,
    COALESCE(weight_kg,0) AS weight,
    COALESCE(buffer_pct,0) AS buffer,
    COALESCE(commission_pct,0) AS commission,
    COALESCE(suggested_selling_price_zar,0) AS sell,
    COALESCE(freight_is_override,false) AS is_override,
    COALESCE(freight_sea_zar,0) AS existing_freight
  FROM public.spark_trade_opportunities
),
computed AS (
  SELECT
    id,
    alibaba * (1 + buffer/100.0) AS adjusted,
    CASE WHEN is_override THEN existing_freight
         ELSE (weight / 200.0) * 8800 END AS freight,
    sell
  FROM calc
),
finalc AS (
  SELECT c.id,
    ROUND(c.freight::numeric, 2) AS freight,
    ROUND(((c.adjusted + c.freight) * (COALESCE(o.commission_pct,0)/100.0))::numeric, 2) AS commission_amt,
    ROUND((c.adjusted + c.freight + (c.adjusted + c.freight) * (COALESCE(o.commission_pct,0)/100.0))::numeric, 2) AS landed,
    ROUND((c.sell - (c.adjusted + c.freight + (c.adjusted + c.freight) * (COALESCE(o.commission_pct,0)/100.0)))::numeric, 2) AS margin,
    CASE WHEN c.sell > 0 THEN
      ROUND(((c.sell - (c.adjusted + c.freight + (c.adjusted + c.freight) * (COALESCE(o.commission_pct,0)/100.0))) / c.sell * 100)::numeric, 2)
      ELSE 0 END AS margin_pct
  FROM computed c
  JOIN public.spark_trade_opportunities o ON o.id = c.id
)
UPDATE public.spark_trade_opportunities o
SET freight_sea_zar = f.freight,
    freight_cost_zar = f.freight,
    umoja_commission_zar = f.commission_amt,
    landed_cost_sea_zar = f.landed,
    landed_cost_zar = f.landed,
    unit_cost_zar = f.landed,
    gross_margin_sea_zar = f.margin,
    gross_margin_zar = f.margin,
    margin_sea_pct = f.margin_pct,
    expected_margin_percentage = f.margin_pct,
    freight_uses_weight_estimate = NOT COALESCE(o.freight_is_override,false)
FROM finalc f
WHERE o.id = f.id;
