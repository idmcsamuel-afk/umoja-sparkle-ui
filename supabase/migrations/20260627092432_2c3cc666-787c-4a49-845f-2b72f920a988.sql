
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS marketplace TEXT DEFAULT 'amazon_us',
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE public.products 
SET product_url = 'https://www.amazon.com/dp/' || asin 
WHERE product_url IS NULL AND asin IS NOT NULL;

UPDATE public.products
SET marketplace = CASE
  WHEN region = 'ZA' THEN 'amazon_sa'
  ELSE 'amazon_us'
END
WHERE marketplace IS NULL OR marketplace = 'amazon_us';

GRANT SELECT, UPDATE ON public.products TO authenticated;
