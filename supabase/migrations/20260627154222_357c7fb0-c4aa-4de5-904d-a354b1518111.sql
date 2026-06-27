ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sales_rank INTEGER,
  ADD COLUMN IF NOT EXISTS sales_rank_category TEXT;