
-- Extract PLID from takealot URL (used as the stable identifier in products.asin)
CREATE OR REPLACE FUNCTION public.extract_takealot_plid(url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (regexp_match(url, 'PLID(\d+)'))[1];
$$;

-- Sync one takealot_products row into public.products (marketplace=takealot_sa)
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
    product_url, image_url, validation_status, created_at
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
    COALESCE(_row.seller_count, 1),
    'takealot_sa',
    _row.takealot_url,
    NULLIF(_row.image_url, ''),
    'pending_review',
    COALESCE(_row.scraped_at, now())
  )
  ON CONFLICT (asin, category, region) DO UPDATE SET
    title      = EXCLUDED.title,
    rating     = EXCLUDED.rating,
    price_zar  = EXCLUDED.price_zar,
    seller_count = EXCLUDED.seller_count,
    product_url= EXCLUDED.product_url,
    image_url  = COALESCE(EXCLUDED.image_url, public.products.image_url);
END;
$$;

-- Trigger: new takealot scrape → auto-sync into products
CREATE OR REPLACE FUNCTION public.trg_takealot_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_takealot_row_to_products(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS takealot_products_sync_trg ON public.takealot_products;
CREATE TRIGGER takealot_products_sync_trg
AFTER INSERT ON public.takealot_products
FOR EACH ROW EXECUTE FUNCTION public.trg_takealot_to_products();

-- One-time backfill of existing takealot rows into products
DO $$
DECLARE r public.takealot_products%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM public.takealot_products LOOP
    PERFORM public.sync_takealot_row_to_products(r);
  END LOOP;
END $$;
