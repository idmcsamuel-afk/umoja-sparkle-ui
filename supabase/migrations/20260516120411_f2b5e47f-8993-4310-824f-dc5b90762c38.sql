
CREATE TABLE public.member_banking_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  account_type text,
  branch_code text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_banking_member ON public.member_banking_details(member_id);

ALTER TABLE public.member_banking_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own banking" ON public.member_banking_details
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Members insert own banking" ON public.member_banking_details
  FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY "Members update own banking" ON public.member_banking_details
  FOR UPDATE TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Admins view all banking" ON public.member_banking_details
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update all banking" ON public.member_banking_details
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_banking_updated_at BEFORE UPDATE ON public.member_banking_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.circle_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid,
  circle_tier text,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  payout_amount numeric(12,2) NOT NULL,
  payout_period text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_circle ON public.circle_payouts(circle_id);
CREATE INDEX idx_payouts_member ON public.circle_payouts(member_id);
CREATE INDEX idx_payouts_status ON public.circle_payouts(status);

ALTER TABLE public.circle_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own payouts" ON public.circle_payouts
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Admins manage all payouts" ON public.circle_payouts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON public.circle_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
