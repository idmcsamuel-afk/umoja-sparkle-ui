
-- 1) Convert community_demand_meter from SECURITY DEFINER to SECURITY INVOKER
ALTER VIEW public.community_demand_meter SET (security_invoker = true);

-- 2) Drop duplicate/legacy public-role policies on members (kept role-scoped versions)
DROP POLICY IF EXISTS members_select_self ON public.members;
DROP POLICY IF EXISTS members_insert_self ON public.members;
DROP POLICY IF EXISTS members_update_self ON public.members;
DROP POLICY IF EXISTS members_delete_self ON public.members;

-- 3) Admin SELECT policy on core_ledger
CREATE POLICY core_ledger_admin_select ON public.core_ledger
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- 4) Admin SELECT policy on fulfillment_shipments
CREATE POLICY "Admins view all shipments" ON public.fulfillment_shipments
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- 5) Re-affirm spark_trade_subscriptions SELECT policy is scoped to authenticated owner/admin
DROP POLICY IF EXISTS "Users view own spark trade subs" ON public.spark_trade_subscriptions;
CREATE POLICY "Users view own spark trade subs" ON public.spark_trade_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
