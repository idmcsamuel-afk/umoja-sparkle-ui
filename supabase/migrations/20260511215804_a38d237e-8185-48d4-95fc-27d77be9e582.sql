
-- 1) Members buyers club fields
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS buyers_club_tier text,
  ADD COLUMN IF NOT EXISTS buyers_club_status text,
  ADD COLUMN IF NOT EXISTS buyers_club_proof_url text,
  ADD COLUMN IF NOT EXISTS buyers_club_amount numeric,
  ADD COLUMN IF NOT EXISTS buyers_club_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyers_club_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyers_club_rejection_reason text;

-- 2) tx_type constraint
ALTER TABLE public.spark_transactions
  DROP CONSTRAINT IF EXISTS spark_transactions_tx_type_check;
ALTER TABLE public.spark_transactions
  ADD CONSTRAINT spark_transactions_tx_type_check CHECK (tx_type = ANY (ARRAY[
    'circle_deposit','circle_payout','platform_fee','withdrawal_fee',
    'referral_bonus','referral_signup','referral_kyc_bonus','referral_admin_bonus',
    'signup_bonus','streak_bonus','ubuntu_fund','ubuntu_market',
    'spark_pit','spark_trade','import_finance',
    'admin_adjustment','manual_credit','buyers_club_join'
  ]));

-- 3) Storage bucket for buyers club proofs
INSERT INTO storage.buckets (id, name, public)
  VALUES ('buyers-club-proofs','buyers-club-proofs', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bcp upload own" ON storage.objects;
CREATE POLICY "bcp upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'buyers-club-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bcp read own" ON storage.objects;
CREATE POLICY "bcp read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buyers-club-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "bcp admin read all" ON storage.objects;
CREATE POLICY "bcp admin read all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'buyers-club-proofs' AND public.is_admin(auth.uid()));

-- 4) Member submission RPC (so they can update their own buyers_club fields safely)
CREATE OR REPLACE FUNCTION public.submit_buyers_club_payment(_tier text, _amount numeric, _proof_url text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _tier NOT IN ('bronze','silver','gold') THEN RAISE EXCEPTION 'invalid tier'; END IF;
  UPDATE public.members
    SET buyers_club_tier = _tier,
        buyers_club_amount = _amount,
        buyers_club_proof_url = _proof_url,
        buyers_club_status = 'payment_pending',
        buyers_club_submitted_at = now()
  WHERE id = auth.uid();
END $$;

-- 5) Admin approve / reject
CREATE OR REPLACE FUNCTION public.admin_approve_buyers_club(_member uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members
    SET has_buyers_club_access = true,
        buyers_club_status = 'active',
        buyers_club_approved_at = now()
  WHERE id = _member;
  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Buyers Club approved 🎉', 'Welcome — real product picks are now unlocked.', 'buyers_club', '/spark');
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_buyers_club(_member uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members
    SET buyers_club_status = 'rejected',
        buyers_club_rejection_reason = _reason
  WHERE id = _member;
  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Buyers Club payment needs attention', COALESCE(_reason,'Please re-submit your proof of payment.'), 'buyers_club', '/spark');
END $$;
