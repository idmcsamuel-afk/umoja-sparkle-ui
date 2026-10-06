DROP FUNCTION IF EXISTS public.get_member_home_notice_settings();
DROP FUNCTION IF EXISTS public.get_member_platform_settings();

CREATE FUNCTION public.get_member_platform_settings()
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
  override_expires_at timestamptz,
  home_circle_24_7_notice_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bank_name, account_name, account_number, branch_code, payment_instructions,
         payouts_seed, payouts_growth, payouts_harvest,
         seed_override_open, growth_override_open, harvest_override_open,
         override_expires_at, home_circle_24_7_notice_enabled
  FROM public.platform_settings
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_member_platform_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_platform_settings() TO authenticated;