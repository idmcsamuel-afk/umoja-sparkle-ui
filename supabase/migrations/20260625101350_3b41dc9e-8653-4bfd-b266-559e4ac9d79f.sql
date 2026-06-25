
ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS is_spotlight BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spotlight_rank INT,
  ADD COLUMN IF NOT EXISTS spotlight_title TEXT;

CREATE INDEX IF NOT EXISTS idx_spark_trade_opps_spotlight
  ON public.spark_trade_opportunities (is_spotlight, spotlight_rank)
  WHERE is_spotlight = true;

-- Unified product catalog: Amazon (sa_price_zar) + Takealot (takealot_price)
CREATE OR REPLACE VIEW public.v_spark_trade_products
WITH (security_invoker = true) AS
SELECT
  ('amazon:' || ap.asin)              AS product_key,
  'amazon'::text                      AS source,
  ap.asin                             AS source_id,
  ap.title                            AS name,
  ap.category                         AS category,
  COALESCE(ap.sa_price_zar, ap.price_zar) AS price_zar,
  ap.image_url                        AS image_url,
  NULL::text                          AS source_url,
  ap.rating                           AS rating,
  ap.review_count                     AS review_count,
  ap.sales_rank                       AS sales_rank,
  ap.opportunity_score                AS opportunity_score,
  ap.last_updated                     AS last_updated
FROM public.amazon_products ap
WHERE COALESCE(ap.sa_price_zar, ap.price_zar) IS NOT NULL
UNION ALL
SELECT
  ('takealot:' || tp.id::text)        AS product_key,
  'takealot'::text                    AS source,
  tp.id::text                         AS source_id,
  tp.takealot_name                    AS name,
  tp.category                         AS category,
  tp.takealot_price                   AS price_zar,
  tp.image_url                        AS image_url,
  tp.takealot_url                     AS source_url,
  tp.rating                           AS rating,
  tp.seller_count                     AS review_count,
  NULL::integer                       AS sales_rank,
  NULL::integer                       AS opportunity_score,
  tp.scraped_at                       AS last_updated
FROM public.takealot_products tp
WHERE tp.takealot_price IS NOT NULL;

GRANT SELECT ON public.v_spark_trade_products TO authenticated, anon, service_role;

-- Commitment status per opportunity
CREATE OR REPLACE VIEW public.v_product_commitment_status
WITH (security_invoker = true) AS
SELECT
  o.id                                                        AS opportunity_id,
  o.product_name,
  o.moq_required,
  o.current_reserved                                          AS legacy_reserved,
  COUNT(DISTINCT r.member_id) FILTER (
    WHERE r.reservation_status IN ('paid','reserved','confirmed')
  )                                                           AS members_committed,
  COALESCE(SUM(r.units_reserved) FILTER (
    WHERE r.reservation_status IN ('paid','reserved','confirmed')
  ), 0)::int                                                  AS total_units,
  COALESCE(SUM(r.total_capital_allocated) FILTER (
    WHERE r.reservation_status IN ('paid','reserved','confirmed')
  ), 0)::numeric                                              AS total_capital,
  CASE
    WHEN COALESCE(o.moq_required, 0) > 0
      THEN LEAST(100, ROUND(
        (COALESCE(SUM(r.units_reserved) FILTER (
          WHERE r.reservation_status IN ('paid','reserved','confirmed')
        ), 0)::numeric / o.moq_required) * 100, 2))
    ELSE 0
  END                                                         AS progress_percent,
  o.group_buy_status                                          AS status,
  MAX(r.updated_at)                                           AS last_activity_at
FROM public.spark_trade_opportunities o
LEFT JOIN public.spark_trade_inventory_reservations r
  ON r.opportunity_id = o.id
GROUP BY o.id, o.product_name, o.moq_required, o.current_reserved, o.group_buy_status;

GRANT SELECT ON public.v_product_commitment_status TO authenticated, anon, service_role;
