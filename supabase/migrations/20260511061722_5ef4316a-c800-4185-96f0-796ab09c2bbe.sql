
-- KYC fields on members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS kyc_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kyc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_photo_url text,
  ADD COLUMN IF NOT EXISTS kyc_document_url text,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;

-- Storage buckets (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('kyc-photos', 'kyc-photos', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('kyc-documents', 'kyc-documents', false)
  ON CONFLICT (id) DO NOTHING;

-- RLS: members upload/read own files; admins read all
CREATE POLICY "kyc_photos_owner_rw"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'kyc-photos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'kyc-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc_photos_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-photos' AND public.is_admin(auth.uid()));

CREATE POLICY "kyc_docs_owner_rw"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc_docs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_admin(auth.uid()));
