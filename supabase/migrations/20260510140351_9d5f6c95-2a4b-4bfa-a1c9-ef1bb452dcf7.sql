DROP POLICY IF EXISTS "admin_select" ON public.admin_users;
CREATE POLICY "admin_select" ON public.admin_users
FOR SELECT TO authenticated
USING (true);