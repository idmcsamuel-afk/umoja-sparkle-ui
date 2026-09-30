DROP POLICY IF EXISTS ais_select_authenticated ON public.amazon_integration_settings;
DROP POLICY IF EXISTS shortlist_select ON public.spark_trade_shortlist;
CREATE POLICY shortlist_admin_select ON public.spark_trade_shortlist FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));