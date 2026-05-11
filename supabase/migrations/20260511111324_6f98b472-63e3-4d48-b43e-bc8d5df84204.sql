
-- 1. Platform settings singleton (bank details for EFT)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text,
  account_name text,
  account_number text,
  branch_code text,
  payment_instructions text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated member needs to read bank details to pay
CREATE POLICY "platform_settings_select_auth"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "platform_settings_admin_insert"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "platform_settings_admin_update"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Touch updated_at
CREATE OR REPLACE FUNCTION public.touch_platform_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_platform_settings ON public.platform_settings;
CREATE TRIGGER trg_touch_platform_settings
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_platform_settings();

-- Seed an empty row so admins always have one to edit
INSERT INTO public.platform_settings (bank_name, account_name, account_number, branch_code)
SELECT NULL, NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- 2. Payment-tracking columns on circle_bids
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- Allow members to cancel their own pending bids
DROP POLICY IF EXISTS "bids_delete_own_pending" ON public.circle_bids;
CREATE POLICY "bids_delete_own_pending"
  ON public.circle_bids FOR DELETE
  TO authenticated
  USING (auth.uid() = member_id AND COALESCE(status,'pending') IN ('pending','payment_pending'));

-- 3. Storage bucket for payment proofs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_proofs_owner_insert" ON storage.objects;
CREATE POLICY "payment_proofs_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "payment_proofs_owner_select" ON storage.objects;
CREATE POLICY "payment_proofs_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "payment_proofs_owner_update" ON storage.objects;
CREATE POLICY "payment_proofs_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
