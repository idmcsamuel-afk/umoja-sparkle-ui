
-- Tighten member_purchases: members read/insert own; admins full
DROP POLICY IF EXISTS purchases_access ON public.member_purchases;
CREATE POLICY purchases_select_own ON public.member_purchases
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY purchases_insert_own ON public.member_purchases
  FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY purchases_admin_all ON public.member_purchases
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Tighten member_purchase_requirements: members read own; admins full
DROP POLICY IF EXISTS requirements_access ON public.member_purchase_requirements;
CREATE POLICY req_select_own ON public.member_purchase_requirements
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY req_admin_all ON public.member_purchase_requirements
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Remove scheduled_messages from realtime to prevent leak
ALTER PUBLICATION supabase_realtime DROP TABLE public.scheduled_messages;
