
ALTER TABLE public.takealot_products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS is_branded boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS is_branded boolean NOT NULL DEFAULT false;

-- Backfill brand from title for a known brand list (case-insensitive)
WITH brands(name) AS (
  VALUES ('NIVEA'),('Puma'),('ASUS'),('HP'),('Lenovo'),('Dell'),('Samsung'),
         ('Apple'),('Sony'),('LG'),('Bosch'),('Philips'),('Adidas'),('Nike'),
         ('Huawei'),('Xiaomi'),('Canon'),('Nikon'),('JBL'),('Logitech'),
         ('Colgate'),('Sunlight'),('Sta-Soft'),('OMO'),('Handy Andy'),
         ('Dettol'),('Vaseline'),('Pantene'),('Dove'),('Garnier'),('L''Oreal'),
         ('Maybelline'),('Revlon'),('Gillette'),('Braun'),('Remington'),
         ('Russell Hobbs'),('Kenwood'),('Defy'),('Hisense'),('TCL'),('Acer'),
         ('MSI'),('Microsoft'),('Xbox'),('PlayStation'),('Nintendo'),
         ('Fitbit'),('Garmin'),('GoPro'),('Kodak'),('New Balance'),('Reebok'),
         ('Under Armour'),('Converse'),('Vans'),('Skechers'),('Crocs'),
         ('Timberland'),('Levi''s'),('Guess'),('Polo'),('Fossil'),('Casio'),
         ('Seiko'),('Fujifilm'),('DJI'),('Anker'),('Belkin'),('TP-Link'),
         ('D-Link'),('Netgear'),('Mikrotik'),('Ubiquiti'),('Epson'),('Brother'),
         ('WD'),('Seagate'),('Kingston'),('SanDisk'),('Crucial'),('Corsair'),
         ('Razer'),('SteelSeries'),('HyperX'),('Bose'),('Sennheiser'),
         ('Marshall'),('Beats'),('Skullcandy'),('Harman Kardon'),
         ('Yamaha'),('Panasonic'),('Sharp'),('Whirlpool'),('KitchenAid'),
         ('Ninja'),('NutriBullet'),('Instant Pot'),('Le Creuset'),('Tefal'),
         ('Pyrex'),('Tupperware')
),
matched_ta AS (
  SELECT tp.plid, b.name
  FROM public.takealot_products tp
  CROSS JOIN LATERAL (
    SELECT name FROM brands
    WHERE tp.takealot_name ILIKE '%' || name || '%'
    ORDER BY length(name) DESC
    LIMIT 1
  ) b
)
UPDATE public.takealot_products tp
SET brand = m.name, is_branded = true
FROM matched_ta m
WHERE tp.plid = m.plid;

WITH brands(name) AS (
  VALUES ('NIVEA'),('Puma'),('ASUS'),('HP'),('Lenovo'),('Dell'),('Samsung'),
         ('Apple'),('Sony'),('LG'),('Bosch'),('Philips'),('Adidas'),('Nike'),
         ('Huawei'),('Xiaomi'),('Canon'),('Nikon'),('JBL'),('Logitech'),
         ('Colgate'),('Sunlight'),('Sta-Soft'),('OMO'),('Handy Andy'),
         ('Dettol'),('Vaseline'),('Pantene'),('Dove'),('Garnier'),('L''Oreal'),
         ('Maybelline'),('Revlon'),('Gillette'),('Braun'),('Remington'),
         ('Russell Hobbs'),('Kenwood'),('Defy'),('Hisense'),('TCL'),('Acer'),
         ('MSI'),('Microsoft'),('Xbox'),('PlayStation'),('Nintendo'),
         ('Fitbit'),('Garmin'),('GoPro'),('Kodak'),('New Balance'),('Reebok'),
         ('Under Armour'),('Converse'),('Vans'),('Skechers'),('Crocs'),
         ('Timberland'),('Levi''s'),('Guess'),('Polo'),('Fossil'),('Casio'),
         ('Seiko'),('Fujifilm'),('DJI'),('Anker'),('Belkin'),('TP-Link'),
         ('D-Link'),('Netgear'),('Mikrotik'),('Ubiquiti'),('Epson'),('Brother'),
         ('WD'),('Seagate'),('Kingston'),('SanDisk'),('Crucial'),('Corsair'),
         ('Razer'),('SteelSeries'),('HyperX'),('Bose'),('Sennheiser'),
         ('Marshall'),('Beats'),('Skullcandy'),('Harman Kardon'),
         ('Yamaha'),('Panasonic'),('Sharp'),('Whirlpool'),('KitchenAid'),
         ('Ninja'),('NutriBullet'),('Instant Pot'),('Le Creuset'),('Tefal'),
         ('Pyrex'),('Tupperware')
),
matched_p AS (
  SELECT p.id, b.name
  FROM public.products p
  CROSS JOIN LATERAL (
    SELECT name FROM brands
    WHERE p.title ILIKE '%' || name || '%'
    ORDER BY length(name) DESC
    LIMIT 1
  ) b
  WHERE p.marketplace = 'takealot_sa'
)
UPDATE public.products p
SET brand = m.name, is_branded = true
FROM matched_p m
WHERE p.id = m.id;

-- Update upsert to accept brand
CREATE OR REPLACE FUNCTION public.upsert_takealot_product(
  _plid text, _name text, _price numeric, _url text, _image text,
  _category text, _rating numeric, _rank integer,
  _review_count integer DEFAULT NULL,
  _brand text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _is_branded boolean := (_brand IS NOT NULL AND btrim(_brand) <> '');
BEGIN
  IF _plid IS NULL OR _plid = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.takealot_products (
    plid, takealot_name, takealot_price, takealot_url, image_url,
    category, rating, search_rank, seller_count, scraped_at,
    first_seen_at, last_seen_at, last_seen_date, times_seen, days_seen,
    review_count, brand, is_branded
  )
  VALUES (
    _plid, _name, _price, _url, NULLIF(_image, ''),
    _category, _rating, _rank, 1, now(),
    now(), now(), _today, 1, 1,
    _review_count, NULLIF(_brand,''), _is_branded
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
    brand          = COALESCE(EXCLUDED.brand, public.takealot_products.brand),
    is_branded     = public.takealot_products.is_branded OR EXCLUDED.is_branded,
    scraped_at     = now(),
    last_seen_at   = now(),
    times_seen     = public.takealot_products.times_seen + 1,
    days_seen      = public.takealot_products.days_seen
                     + CASE WHEN public.takealot_products.last_seen_date IS DISTINCT FROM _today THEN 1 ELSE 0 END,
    last_seen_date = _today;
END;
$function$;

-- Update sync-to-products to copy brand fields
CREATE OR REPLACE FUNCTION public.sync_takealot_row_to_products(_row takealot_products)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    sales_rank, sales_rank_category, days_seen, times_seen,
    brand, is_branded
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
    _row.times_seen,
    _row.brand,
    COALESCE(_row.is_branded, false)
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
    times_seen          = EXCLUDED.times_seen,
    brand               = COALESCE(EXCLUDED.brand, public.products.brand),
    is_branded          = public.products.is_branded OR COALESCE(EXCLUDED.is_branded, false);
END;
$function$;
