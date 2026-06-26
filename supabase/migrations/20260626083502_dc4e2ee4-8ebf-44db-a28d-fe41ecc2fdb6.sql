GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_discovery TO authenticated;
GRANT ALL ON public.product_discovery TO service_role;

CREATE POLICY "Admins can read product_discovery"
ON public.product_discovery FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE POLICY "Admins can update product_discovery"
ON public.product_discovery FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));