ALTER TABLE public.product_feeds ADD COLUMN IF NOT EXISTS moq integer DEFAULT 0;
ALTER TABLE public.product_feeds ADD COLUMN IF NOT EXISTS stock_available integer DEFAULT 0;
ALTER TABLE public.product_feeds ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.product_feeds ADD COLUMN IF NOT EXISTS monthly_search_volume integer DEFAULT 0;
