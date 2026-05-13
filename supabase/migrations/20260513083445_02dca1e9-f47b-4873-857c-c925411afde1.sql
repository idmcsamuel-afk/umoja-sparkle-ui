
-- 1. Bank accounts table for multi-account payment routing
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  branch_code text NOT NULL,
  account_holder text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  for_circle boolean NOT NULL DEFAULT false,
  for_spark_trade boolean NOT NULL DEFAULT false,
  for_drive boolean NOT NULL DEFAULT false,
  for_property boolean NOT NULL DEFAULT false,
  for_buyers_club boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts public read"
  ON public.bank_accounts FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "bank_accounts admin all"
  ON public.bank_accounts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER touch_bank_accounts
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Add payment-flow columns to reit_units (property investments)
ALTER TABLE public.reit_units
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'payment_pending',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid;

-- 3. Property payment-proofs storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-payment-proofs', 'property-payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "property proofs upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "property proofs read own or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'property-payment-proofs'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );
