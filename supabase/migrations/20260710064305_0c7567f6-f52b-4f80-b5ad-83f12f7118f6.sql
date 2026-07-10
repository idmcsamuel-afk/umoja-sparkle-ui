
-- 1. Add review_count to takealot_products
ALTER TABLE public.takealot_products
  ADD COLUMN IF NOT EXISTS review_count integer;

-- 2. Update upsert function to accept review_count
CREATE OR REPLACE FUNCTION public.upsert_takealot_product(
  _plid text,
  _name text,
  _price numeric,
  _url text,
  _image text,
  _category text,
  _rating numeric,
  _rank integer,
  _review_count integer DEFAULT NULL
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
    first_seen_at, last_seen_at, last_seen_date, times_seen, days_seen,
    review_count
  )
  VALUES (
    _plid, _name, _price, _url, NULLIF(_image, ''),
    _category, _rating, _rank, 1, now(),
    now(), now(), _today, 1, 1,
    _review_count
  )
  ON CONFLICT (plid) DO UPDATE SET
    takealot_name  = EXCLUDED.takealot_name,
    takealot_price = EXCLUDED.takealot_price,
    takealot_url   = EXCLUDED.takealot_url,
    image_url      = COALESCE(NULLIF(EXCLUDED.image_url, ''), public.takealot_products.image_url),
    category       = EXCLUDED.category,
    rating         = COALESCE(EXCLUDED.rating, public.takealot_products.rating),
    review_count   = COALESCE(EXCLUDED.review_count, public.takealot_products.review_count),
    search_rank    = EXCLUDED.search_rank,
    scraped_at     = now(),
    last_seen_at   = now(),
    times_seen     = public.takealot_products.times_seen + 1,
    days_seen      = public.takealot_products.days_seen
                     + CASE WHEN public.takealot_products.last_seen_date IS DISTINCT FROM _today THEN 1 ELSE 0 END,
    last_seen_date = _today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_takealot_product(text,text,numeric,text,text,text,numeric,integer,integer) TO service_role;

-- 3. Update sync to carry review_count into products
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
    _row.review_count,
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
    review_count        = COALESCE(EXCLUDED.review_count, public.products.review_count),
    price_zar           = EXCLUDED.price_zar,
    product_url         = EXCLUDED.product_url,
    image_url           = COALESCE(EXCLUDED.image_url, public.products.image_url),
    sales_rank          = EXCLUDED.sales_rank,
    sales_rank_category = EXCLUDED.sales_rank_category,
    days_seen           = EXCLUDED.days_seen,
    times_seen          = EXCLUDED.times_seen;
END;
$$;
