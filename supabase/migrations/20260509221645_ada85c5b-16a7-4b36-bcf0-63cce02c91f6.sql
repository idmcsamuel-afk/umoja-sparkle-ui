
-- 1. Admin role table (separate from members for safety)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _uid) $$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;

-- 2. Enable RLS on tables that had policies but RLS was off
ALTER TABLE public.circle_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubuntu_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_trade_shortlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 3. drive_members: replace permissive policy
DROP POLICY IF EXISTS full_access ON public.drive_members;
CREATE POLICY drive_members_select ON public.drive_members
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY drive_members_insert ON public.drive_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY drive_members_update ON public.drive_members
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY drive_members_delete ON public.drive_members
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

-- 4. drive_repayments: scoped to member, read-only from client
DROP POLICY IF EXISTS full_access ON public.drive_repayments;
CREATE POLICY drive_repayments_select ON public.drive_repayments
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

-- 5. predictor_entries
DROP POLICY IF EXISTS full_access ON public.predictor_entries;
-- leaderboard needs to count across all members; allow read but no PII columns are sensitive here
CREATE POLICY predictor_entries_select ON public.predictor_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY predictor_entries_insert ON public.predictor_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- 6. spark_trade_shortlist: public read, only authenticated may update joined_count, admin-only insert/delete
DROP POLICY IF EXISTS full_access ON public.spark_trade_shortlist;
CREATE POLICY shortlist_select ON public.spark_trade_shortlist
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY shortlist_update ON public.spark_trade_shortlist
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY shortlist_admin_insert ON public.spark_trade_shortlist
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY shortlist_admin_delete ON public.spark_trade_shortlist
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 7. waitlist: keep public insert, restrict select to admins
DROP POLICY IF EXISTS waitlist_select ON public.waitlist;
DROP POLICY IF EXISTS waitlist_insert ON public.waitlist;
CREATE POLICY waitlist_insert ON public.waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY waitlist_admin_select ON public.waitlist
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 8. ubuntu_fund: authenticated read; writes only via SECURITY DEFINER function
DROP POLICY IF EXISTS ubuntu_all ON public.ubuntu_fund;
CREATE POLICY ubuntu_select ON public.ubuntu_fund
  FOR SELECT TO authenticated USING (true);

-- 9. spark_transactions: include recipient in select
DROP POLICY IF EXISTS txns_select ON public.spark_transactions;
CREATE POLICY txns_select ON public.spark_transactions
  FOR SELECT TO authenticated USING (auth.uid() = from_member OR auth.uid() = to_member);

-- 10. members: prevent self-promotion (is_admin, kyc_status, rank)
CREATE OR REPLACE FUNCTION public.protect_privileged_member_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.is_admin := OLD.is_admin;
  NEW.kyc_status := OLD.kyc_status;
  NEW.rank := OLD.rank;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS members_protect_privileged ON public.members;
CREATE TRIGGER members_protect_privileged
BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_member_fields();

-- 11. Lock down existing SECURITY DEFINER function and fix search_path
CREATE OR REPLACE FUNCTION public.increment_ubuntu_fund(contribution numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ubuntu_fund
     SET balance = balance + contribution, updated_at = now()
   WHERE id = (SELECT id FROM public.ubuntu_fund LIMIT 1);
$$;
REVOKE EXECUTE ON FUNCTION public.increment_ubuntu_fund(numeric) FROM anon, authenticated, public;
