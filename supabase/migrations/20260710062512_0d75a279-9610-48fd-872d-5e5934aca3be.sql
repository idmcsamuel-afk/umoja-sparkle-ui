
-- 1. Add tracking columns to takealot_products
ALTER TABLE public.takealot_products
  ADD COLUMN IF NOT EXISTS plid text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_date date,
  ADD COLUMN IF NOT EXISTS times_seen integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS days_seen integer NOT NULL DEFAULT 1;

-- Populate plid on existing rows
UPDATE public.takealot_products
SET plid = public.extract_takealot_plid(takealot_url)
WHERE plid IS NULL;

-- Remove rows we can't identify (no PLID in URL)
DELETE FROM public.takealot_products WHERE plid IS NULL OR plid = '';

-- 2. Backfill: dedupe existing rows down to one per plid, preserving history
WITH agg AS (
  SELECT plid,
    MIN(scraped_at) AS first_seen,
    MAX(scraped_at) AS last_seen,
    COUNT(*)::int AS times_seen_v,
    COUNT(DISTINCT (scraped_at AT TIME ZONE 'UTC')::date)::int AS days_seen_v,
    MAX((scraped_at AT TIME ZONE 'UTC')::date) AS last_date
  FROM public.takealot_products
  GROUP BY plid
),
keep AS (
  SELECT DISTINCT ON (plid) id, plid
  FROM public.takealot_products
  ORDER BY plid, scraped_at DESC, id
)
UPDATE public.takealot_products t
SET first_seen_at  = a.first_seen,
    last_seen_at   = a.last_seen,
    last_seen_date = a.last_date,
    times_seen     = a.times_seen_v,
    days_seen      = a.days_seen_v
FROM agg a, keep k
WHERE t.id = k.id AND t.plid = a.plid AND t.plid = k.plid;

-- Delete duplicate rows (all but the newest kept row per plid)
DELETE FROM public.takealot_products t
USING (
  SELECT DISTINCT ON (plid) id, plid
  FROM public.takealot_products
  ORDER BY plid, scraped_at DESC, id
) keep
WHERE t.plid = keep.plid AND t.id <> keep.id;

-- 3. Enforce uniqueness on plid
ALTER TABLE public.takealot_products ALTER COLUMN plid SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS takealot_products_plid_key
  ON public.takealot_products(plid);

-- 4. Upsert function used by the scraper
CREATE OR REPLACE FUNCTION public.upsert_takealot_product(
  _plid text,
  _name text,
  _price numeric,
  _url text,
  _image text,
  _category text,
  _rating numeric,
  _rank integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF _plid IS NULL OR _plid = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.takealot_products (
    plid, takealot_name, takealot_price, takealot_url, image_url,
    category, rating, search_rank, seller_count, scraped_at,
    first_seen_at, last_seen_at, last_seen_date, times_seen, days_seen
  )
  VALUES (
    _plid, _name, _price, _url, NULLIF(_image, ''),
    _category, _rating, _rank, 1, now(),
    now(), now(), _today, 1, 1
  )
  ON CONFLICT (plid) DO UPDATE SET
    takealot_name  = EXCLUDED.takealot_name,
    takealot_price = EXCLUDED.takealot_price,
    takealot_url   = EXCLUDED.takealot_url,
    image_url      = COALESCE(NULLIF(EXCLUDED.image_url, ''), public.takealot_products.image_url),
    category       = EXCLUDED.category,
    rating         = COALESCE(EXCLUDED.rating, public.takealot_products.rating),
    search_rank    = EXCLUDED.search_rank,
    scraped_at     = now(),
    last_seen_at   = now(),
    times_seen     = public.takealot_products.times_seen + 1,
    days_seen      = public.takealot_products.days_seen
                     + CASE WHEN public.takealot_products.last_seen_date IS DISTINCT FROM _today THEN 1 ELSE 0 END,
    last_seen_date = _today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_takealot_product(text,text,numeric,text,text,text,numeric,integer) TO service_role;

-- 5. Add consistency columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS days_seen  integer,
  ADD COLUMN IF NOT EXISTS times_seen integer;

-- 6. Refresh sync: also carry days_seen / times_seen and refresh on UPDATE
CREATE OR REPLACE FUNCTION public.sync_takealot_row_to_products(_row public.takealot_products)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plid text;
BEGIN
  _plid := COALESCE(_row.plid, public.extract_takealot_plid(_row.takealot_url));
  IF _plid IS NULL OR _plid = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.products (
    category, region, asin, title, rating, review_count,
    price_usd, price_zar, seller_count, marketplace,
    product_url, image_url, validation_status, created_at,
    sales_rank, sales_rank_category, days_seen, times_seen
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
    COALESCE(_row.first_seen_at, _row.scraped_at, now()),
    _row.search_rank,
    CASE WHEN _row.category IS NOT NULL THEN 'Takealot ' || _row.category ELSE 'Takealot' END,
    _row.days_seen,
    _row.times_seen
  )
  ON CONFLICT (asin, category, region) DO UPDATE SET
    title               = EXCLUDED.title,
    rating              = EXCLUDED.rating,
    price_zar           = EXCLUDED.price_zar,
    product_url         = EXCLUDED.product_url,
    image_url           = COALESCE(EXCLUDED.image_url, public.products.image_url),
    sales_rank          = EXCLUDED.sales_rank,
    sales_rank_category = EXCLUDED.sales_rank_category,
    days_seen           = EXCLUDED.days_seen,
    times_seen          = EXCLUDED.times_seen;
END;
$$;

-- Fire on UPDATE too so the upsert path refreshes products
DROP TRIGGER IF EXISTS takealot_products_sync_trg ON public.takealot_products;
CREATE TRIGGER takealot_products_sync_trg
AFTER INSERT OR UPDATE ON public.takealot_products
FOR EACH ROW EXECUTE FUNCTION public.trg_takealot_to_products();

-- 7. Re-sync all takealot rows into products (dedupes there too via ON CONFLICT)
DO $$
DECLARE r public.takealot_products%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM public.takealot_products LOOP
    PERFORM public.sync_takealot_row_to_products(r);
  END LOOP;
END $$;

-- 8. Clean up leftover duplicate products rows for takealot_sa (should be idempotent)
DELETE FROM public.products p
USING public.products q
WHERE p.marketplace = 'takealot_sa'
  AND q.marketplace = 'takealot_sa'
  AND p.asin = q.asin
  AND p.category = q.category
  AND p.region = q.region
  AND p.ctid > q.ctid;
