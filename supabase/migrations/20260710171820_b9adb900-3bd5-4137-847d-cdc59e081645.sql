
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS alibaba_url text,
  ADD COLUMN IF NOT EXISTS alibaba_price text,
  ADD COLUMN IF NOT EXISTS alibaba_moq integer,
  ADD COLUMN IF NOT EXISTS alibaba_supplier text;
