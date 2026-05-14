
-- Add status + proof for EFT review and unique payment ref to prevent dupes
ALTER TABLE public.drive_contributions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS payment_proof_url text;

CREATE UNIQUE INDEX IF NOT EXISTS drive_contributions_payment_ref_uniq
  ON public.drive_contributions (payment_ref) WHERE payment_ref IS NOT NULL;

-- Client-callable: enforces auth, ownership, 6-day cooldown for EFT submissions.
-- Inserts as 'pending' so admin must approve before score updates.
CREATE OR REPLACE FUNCTION public.submit_drive_eft_contribution(
  _enrollment uuid,
  _amount numeric,
  _ref text,
  _proof_url text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  enr public.drive_enrollments%ROWTYPE;
  last_dt timestamptz;
  next_week int;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO enr FROM public.drive_enrollments WHERE id = _enrollment;
  IF enr.id IS NULL THEN RAISE EXCEPTION 'enrollment not found'; END IF;
  IF enr.member_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  SELECT MAX(created_at) INTO last_dt FROM public.drive_contributions
    WHERE enrollment_id = _enrollment AND status IN ('completed','pending');
  IF last_dt IS NOT NULL AND last_dt > now() - interval '6 days' THEN
    RAISE EXCEPTION 'cooldown: next payment available in % days',
      CEIL(EXTRACT(EPOCH FROM (last_dt + interval '7 days' - now())) / 86400);
  END IF;

  SELECT COALESCE(MAX(week_number),0) + 1 INTO next_week
    FROM public.drive_contributions WHERE enrollment_id = _enrollment;

  INSERT INTO public.drive_contributions
    (enrollment_id, member_id, amount, week_number, payment_date, is_on_time, payment_method, payment_ref, status)
  VALUES
    (_enrollment, auth.uid(), _amount, next_week, CURRENT_DATE, true, 'eft', _ref, 'pending')
  RETURNING id INTO new_id;

  -- Save proof URL if provided
  IF _proof_url IS NOT NULL AND length(_proof_url) > 0 THEN
    UPDATE public.drive_contributions SET payment_proof_url = _proof_url WHERE id = new_id;
  END IF;

  INSERT INTO public.notifications (member_id, title, body, kind, link)
  VALUES (auth.uid(), 'Drive EFT submitted',
          'Your week ' || next_week || ' EFT proof is awaiting admin approval.',
          'drive', '/drive/dashboard');

  RETURN new_id;
END $fn$;

GRANT EXECUTE ON FUNCTION public.submit_drive_eft_contribution(uuid, numeric, text, text) TO authenticated;

-- Storage bucket for EFT proofs
INSERT INTO storage.buckets (id, name, public)
  VALUES ('drive-payment-proofs', 'drive-payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "drive_proofs_owner_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'drive-payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "drive_proofs_owner_write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'drive-payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "drive_proofs_admin_all" ON storage.objects FOR ALL
  USING (bucket_id = 'drive-payment-proofs' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'drive-payment-proofs' AND public.is_admin(auth.uid()));
