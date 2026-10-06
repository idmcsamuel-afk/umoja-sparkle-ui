ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS home_circle_24_7_notice_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_member_home_notice_settings()
RETURNS TABLE (home_circle_24_7_notice_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.home_circle_24_7_notice_enabled
  FROM public.platform_settings ps
  ORDER BY ps.updated_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_member_home_notice_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_home_notice_settings() TO authenticated;