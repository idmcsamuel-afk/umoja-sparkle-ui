
-- 1. Add status column to members for moderation
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 2. Allow admins to view & update all members
DROP POLICY IF EXISTS members_admin_select ON public.members;
CREATE POLICY members_admin_select ON public.members FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS members_admin_update ON public.members;
CREATE POLICY members_admin_update ON public.members FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3. Allow admins to update circle bids (mark paid + payout_date)
ALTER TABLE public.circle_bids ADD COLUMN IF NOT EXISTS payout_date timestamptz;
DROP POLICY IF EXISTS bids_admin_update ON public.circle_bids;
CREATE POLICY bids_admin_update ON public.circle_bids FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS bids_admin_select ON public.circle_bids;
CREATE POLICY bids_admin_select ON public.circle_bids FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. Backfill missing members from auth.users
INSERT INTO public.members (id, full_name, phone, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Member'),
       COALESCE(u.phone, u.raw_user_meta_data->>'phone', u.email, u.id::text),
       u.email
  FROM auth.users u
  LEFT JOIN public.members m ON m.id = u.id
 WHERE m.id IS NULL;

-- 5. Auto-create member row on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.members (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Member'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NEW.email, NEW.id::text),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
