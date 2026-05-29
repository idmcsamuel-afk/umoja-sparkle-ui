ALTER TABLE public.product_memberships
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid_zar NUMERIC,
  ADD COLUMN IF NOT EXISTS amount_local_currency NUMERIC,
  ADD COLUMN IF NOT EXISTS local_currency_code TEXT;