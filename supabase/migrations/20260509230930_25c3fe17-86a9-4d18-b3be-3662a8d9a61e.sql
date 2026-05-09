
-- Tighten spark_trade_shortlist UPDATE: only admins should write
DROP POLICY IF EXISTS shortlist_update ON public.spark_trade_shortlist;
CREATE POLICY shortlist_admin_update ON public.spark_trade_shortlist
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow authenticated users to increment joined_count via a SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.join_spark_trade(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  UPDATE public.spark_trade_shortlist
     SET joined_count = COALESCE(joined_count,0) + 1
   WHERE id = _id
     AND COALESCE(joined_count,0) < COALESCE(target_slots, 0);
END $$;
REVOKE ALL ON FUNCTION public.join_spark_trade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_spark_trade(uuid) TO authenticated;

-- Attach the privileged-fields protection trigger on members (function existed but no trigger)
DROP TRIGGER IF EXISTS members_protect_privileged ON public.members;
CREATE TRIGGER members_protect_privileged
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_member_fields();

-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_ubuntu_fund(numeric) FROM PUBLIC, anon, authenticated;

-- Add RLS policies for tables that have RLS enabled but no policies (default-deny → add scoped reads)

-- admin_users: only admins may read; no client writes
CREATE POLICY admin_users_select ON public.admin_users
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ai_subscriptions: owner read/write
CREATE POLICY ai_subs_select ON public.ai_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY ai_subs_insert ON public.ai_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY ai_subs_update ON public.ai_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);

-- core_ledger: owner read only
CREATE POLICY core_ledger_select ON public.core_ledger
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

-- finzite_scores: owner read only
CREATE POLICY finzite_scores_select ON public.finzite_scores
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

-- health_snapshots: admin-only read
CREATE POLICY health_snapshots_select ON public.health_snapshots
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- import_finance_apps: owner read/insert
CREATE POLICY import_apps_select ON public.import_finance_apps
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY import_apps_insert ON public.import_finance_apps
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- st_buying_groups: public read (open buying groups)
CREATE POLICY st_groups_select ON public.st_buying_groups
  FOR SELECT TO anon, authenticated USING (true);

-- st_orders: owner read/insert
CREATE POLICY st_orders_select ON public.st_orders
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY st_orders_insert ON public.st_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

-- st_products: public read of catalog
CREATE POLICY st_products_select ON public.st_products
  FOR SELECT TO anon, authenticated USING (COALESCE(is_active, true));

-- ubuntu_fund_txns: admin-only read
CREATE POLICY ubuntu_txns_select ON public.ubuntu_fund_txns
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
