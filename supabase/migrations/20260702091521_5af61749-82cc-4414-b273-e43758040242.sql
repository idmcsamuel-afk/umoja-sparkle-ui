
-- 1) product_discovery: standardize on is_admin()
DROP POLICY IF EXISTS "Admins can read product_discovery" ON public.product_discovery;
DROP POLICY IF EXISTS "Admins can update product_discovery" ON public.product_discovery;

CREATE POLICY "Admins can read product_discovery" ON public.product_discovery
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update product_discovery" ON public.product_discovery
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2) circle_bids: block members from changing sensitive fields via trigger
CREATE OR REPLACE FUNCTION public.circle_bids_guard_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins and service role to change anything
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Members: block edits to financial and scoring fields
  IF NEW.spark_amount IS DISTINCT FROM OLD.spark_amount
     OR NEW.fiat_amount IS DISTINCT FROM OLD.fiat_amount
     OR NEW.payout_amount IS DISTINCT FROM OLD.payout_amount
     OR NEW.priority_score IS DISTINCT FROM OLD.priority_score
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.circle_id IS DISTINCT FROM OLD.circle_id
     OR NEW.tier_id IS DISTINCT FROM OLD.tier_id
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.payout_status IS DISTINCT FROM OLD.payout_status
     OR NEW.payout_paid_at IS DISTINCT FROM OLD.payout_paid_at
     OR NEW.quarantined_at IS DISTINCT FROM OLD.quarantined_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected circle_bids fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_bids_guard_member_update ON public.circle_bids;
CREATE TRIGGER trg_circle_bids_guard_member_update
  BEFORE UPDATE ON public.circle_bids
  FOR EACH ROW EXECUTE FUNCTION public.circle_bids_guard_member_update();

-- 3) drive_enrollments: block members from changing score/contribution fields
CREATE OR REPLACE FUNCTION public.drive_enrollments_guard_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.priority_score IS DISTINCT FROM OLD.priority_score
     OR NEW.weeks_contributed IS DISTINCT FROM OLD.weeks_contributed
     OR NEW.weeks_paid_on_time IS DISTINCT FROM OLD.weeks_paid_on_time
     OR NEW.total_contributed IS DISTINCT FROM OLD.total_contributed
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected drive_enrollments fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drive_enrollments_guard_member_update ON public.drive_enrollments;
CREATE TRIGGER trg_drive_enrollments_guard_member_update
  BEFORE UPDATE ON public.drive_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.drive_enrollments_guard_member_update();

-- 4) drive_members: block members from changing total_contributed and status
CREATE OR REPLACE FUNCTION public.drive_members_guard_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.total_contributed IS DISTINCT FROM OLD.total_contributed
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected drive_members fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drive_members_guard_member_update ON public.drive_members;
CREATE TRIGGER trg_drive_members_guard_member_update
  BEFORE UPDATE ON public.drive_members
  FOR EACH ROW EXECUTE FUNCTION public.drive_members_guard_member_update();

-- 5) reit_units: split ALL policy into member SELECT/INSERT + admin ALL
DROP POLICY IF EXISTS reit_units_all ON public.reit_units;

CREATE POLICY reit_units_member_select ON public.reit_units
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY reit_units_member_insert ON public.reit_units
  FOR INSERT WITH CHECK (auth.uid() = member_id);

CREATE POLICY reit_units_admin_all ON public.reit_units
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
