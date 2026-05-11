-- 1) Admin user list no longer readable by every authenticated user
DROP POLICY IF EXISTS admin_select ON public.admin_users;

-- 2) Admin invite codes no longer publicly readable; redemption goes through redeem_invite_code RPC
DROP POLICY IF EXISTS admin_invites_public_validate ON public.admin_invite_codes;

-- 3) Platform settings: restrict SELECT to admins, expose member-safe view via RPC
DROP POLICY IF EXISTS platform_settings_select_auth ON public.platform_settings;
CREATE POLICY platform_settings_admin_select
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_member_platform_settings()
RETURNS TABLE (
  bank_name text,
  account_name text,
  account_number text,
  branch_code text,
  payment_instructions text,
  payouts_seed integer,
  payouts_growth integer,
  payouts_harvest integer,
  seed_override_open boolean,
  growth_override_open boolean,
  harvest_override_open boolean,
  override_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bank_name, account_name, account_number, branch_code, payment_instructions,
         payouts_seed, payouts_growth, payouts_harvest,
         seed_override_open, growth_override_open, harvest_override_open,
         override_expires_at
    FROM public.platform_settings
    ORDER BY updated_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_member_platform_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_platform_settings() TO authenticated;

-- 4) Circle allocations: restrict to admins
DROP POLICY IF EXISTS alloc_select_auth ON public.circle_allocations;
CREATE POLICY alloc_admin_select
  ON public.circle_allocations
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5) Tighten member UPDATE on circle_bids: only their own row, only when in pending/payment_pending,
--    and only into safe statuses. Sensitive transitions remain admin-only via bids_admin_update.
DROP POLICY IF EXISTS bids_update ON public.circle_bids;
CREATE POLICY bids_update_member_safe
  ON public.circle_bids
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = member_id
    AND COALESCE(status, 'pending') IN ('pending', 'payment_pending')
  )
  WITH CHECK (
    auth.uid() = member_id
    AND COALESCE(status, 'pending') IN ('pending', 'payment_pending', 'cancelled')
  );

-- 6) Set fixed search_path on gen_referral_code (linter: function_search_path_mutable)
CREATE OR REPLACE FUNCTION public.gen_referral_code(_seed text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.members WHERE referral_code = result);
    attempts := attempts + 1;
    IF attempts > 10 THEN EXIT; END IF;
  END LOOP;
  RETURN result;
END $function$;