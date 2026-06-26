ALTER TABLE public.product_discovery
  ADD COLUMN IF NOT EXISTS alibaba_product_url TEXT,
  ADD COLUMN IF NOT EXISTS alibaba_supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS alibaba_supplier_rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS amazon_product_url TEXT,
  ADD COLUMN IF NOT EXISTS amazon_rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS amazon_reviews_count INT,
  ADD COLUMN IF NOT EXISTS takealot_product_url TEXT,
  ADD COLUMN IF NOT EXISTS takealot_rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS takealot_reviews_count INT,
  ADD COLUMN IF NOT EXISTS data_validation_status TEXT DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS validation_notes TEXT;