
-- 1. trending_products: replace ALL policy with SELECT-only for authenticated; admin-only writes
DROP POLICY IF EXISTS trending_access ON public.trending_products;
CREATE POLICY trending_select_auth ON public.trending_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY trending_admin_write ON public.trending_products
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. group_buys: SELECT for authenticated; writes admin-only
DROP POLICY IF EXISTS group_buys_access ON public.group_buys;
CREATE POLICY group_buys_select_auth ON public.group_buys
  FOR SELECT TO authenticated USING (true);
CREATE POLICY group_buys_admin_write ON public.group_buys
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Explicit admin-only SELECT policies for documentation/safety
CREATE POLICY china_supplier_prices_admin_select ON public.china_supplier_prices
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY purchase_requirement_settings_admin_select ON public.purchase_requirement_settings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- shipping_rates: members need rates for cost calculator; allow authenticated read, admin write
CREATE POLICY shipping_rates_auth_select ON public.shipping_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY shipping_rates_admin_write ON public.shipping_rates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
