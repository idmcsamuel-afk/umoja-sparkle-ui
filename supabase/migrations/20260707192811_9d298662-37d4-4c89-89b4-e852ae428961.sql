
ALTER TABLE public.takealot_products ADD COLUMN IF NOT EXISTS search_rank integer;

-- Backfill: rank by id order within each (category, scraped_at::date) batch
WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY category, date_trunc('day', scraped_at) ORDER BY id) AS rn
  FROM public.takealot_products
)
UPDATE public.takealot_products t
SET search_rank = ranked.rn
FROM ranked
WHERE t.id = ranked.id AND t.search_rank IS NULL;

-- Update sync function to include rank
CREATE OR REPLACE FUNCTION public.sync_takealot_row_to_products(_row public.takealot_products)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plid text;
BEGIN
  _plid := public.extract_takealot_plid(_row.takealot_url);
  IF _plid IS NULL OR _plid = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.products (
    category, region, asin, title, rating, review_count,
    price_usd, price_zar, seller_count, marketplace,
    product_url, image_url, validation_status, created_at,
    sales_rank, sales_rank_category
  )
  VALUES (
    COALESCE(_row.category, 'general'),
    'ZA',
    _plid,
    _row.takealot_name,
    _row.rating,
    NULL,
    NULL,
    _row.takealot_price,
    NULL,
    'takealot_sa',
    _row.takealot_url,
    NULLIF(_row.image_url, ''),
    'pending_review',
    COALESCE(_row.scraped_at, now()),
    _row.search_rank,
    CASE WHEN _row.category IS NOT NULL THEN 'Takealot ' || _row.category ELSE 'Takealot' END
  )
  ON CONFLICT (asin, category, region) DO UPDATE SET
    title       = EXCLUDED.title,
    rating      = EXCLUDED.rating,
    price_zar   = EXCLUDED.price_zar,
    product_url = EXCLUDED.product_url,
    image_url   = COALESCE(EXCLUDED.image_url, public.products.image_url),
    sales_rank  = EXCLUDED.sales_rank,
    sales_rank_category = EXCLUDED.sales_rank_category;
END;
$$;

-- Re-run backfill for existing takealot_products so products.sales_rank populates
DO $$
DECLARE r public.takealot_products%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM public.takealot_products LOOP
    PERFORM public.sync_takealot_row_to_products(r);
  END LOOP;
END $$;
