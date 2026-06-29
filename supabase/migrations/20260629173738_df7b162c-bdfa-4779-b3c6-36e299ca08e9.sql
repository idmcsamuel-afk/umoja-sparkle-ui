
ALTER TABLE public.spark_trade_opportunities
  ADD COLUMN IF NOT EXISTS original_reference_name text,
  ADD COLUMN IF NOT EXISTS original_reference_image_url text;

CREATE OR REPLACE FUNCTION public.spark_trade_preserve_original_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_name IS DISTINCT FROM OLD.product_name
     AND OLD.original_reference_name IS NULL THEN
    NEW.original_reference_name := OLD.product_name;
  END IF;

  IF NEW.product_image_url IS DISTINCT FROM OLD.product_image_url
     AND OLD.original_reference_image_url IS NULL THEN
    NEW.original_reference_image_url := OLD.product_image_url;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spark_trade_preserve_original_reference ON public.spark_trade_opportunities;
CREATE TRIGGER trg_spark_trade_preserve_original_reference
BEFORE UPDATE ON public.spark_trade_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.spark_trade_preserve_original_reference();
