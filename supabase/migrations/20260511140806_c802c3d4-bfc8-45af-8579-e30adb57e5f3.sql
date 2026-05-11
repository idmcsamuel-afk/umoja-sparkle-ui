
-- drive_circles: restrict creation to admins
DROP POLICY IF EXISTS drive_circles_insert ON public.drive_circles;
CREATE POLICY drive_circles_admin_insert ON public.drive_circles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- ubuntu_fund: restrict balance reads to admins
DROP POLICY IF EXISTS ubuntu_select ON public.ubuntu_fund;
CREATE POLICY ubuntu_admin_select ON public.ubuntu_fund
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
