
CREATE OR REPLACE FUNCTION public.products_set_price_zar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.price_usd IS NOT NULL AND NEW.price_zar IS NULL THEN
    IF NEW.marketplace::text IN ('amazon_sa', 'takealot_sa') THEN
      -- SA marketplaces capture prices already in ZAR; never convert.
      NEW.price_zar := ROUND(NEW.price_usd, 2);
    ELSE
      NEW.price_zar := ROUND(NEW.price_usd * public.current_usd_zar_rate(), 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
