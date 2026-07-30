
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS usd_zar_rate numeric NOT NULL DEFAULT 18.5;

CREATE OR REPLACE FUNCTION public.current_usd_zar_rate()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT usd_zar_rate FROM public.platform_settings ORDER BY created_at DESC LIMIT 1), 18.5);
$$;

CREATE OR REPLACE FUNCTION public.products_set_price_zar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.price_usd IS NOT NULL AND NEW.price_zar IS NULL THEN
    NEW.price_zar := ROUND(NEW.price_usd * public.current_usd_zar_rate(), 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_price_zar ON public.products;
CREATE TRIGGER trg_products_set_price_zar
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_set_price_zar();

UPDATE public.products
SET price_zar = ROUND(price_usd * public.current_usd_zar_rate(), 2)
WHERE price_usd IS NOT NULL AND price_zar IS NULL
  AND marketplace IN ('amazon_us','amazon_sa','walmart_us');
