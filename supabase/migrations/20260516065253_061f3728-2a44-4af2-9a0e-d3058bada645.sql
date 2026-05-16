CREATE POLICY "Anyone can read active subscription plans"
ON public.subscription_plans
FOR SELECT
TO anon, authenticated
USING (is_active = true);