-- Allow authenticated users to read admin_users (so AdminRoute check works without recursion)
DROP POLICY IF EXISTS admin_users_select ON public.admin_users;
CREATE POLICY admin_read ON public.admin_users
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated members to create drive_circles (so synthetic forming circles can become real on first join)
CREATE POLICY drive_circles_insert ON public.drive_circles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY drive_circles_update ON public.drive_circles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
