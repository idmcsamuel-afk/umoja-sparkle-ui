-- Switch graphics usage from daily to weekly counter
CREATE OR REPLACE FUNCTION public.flame_graphics_count_week()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.flame_graphics_usage
  WHERE member_id = auth.uid()
    AND created_at >= date_trunc('week', now() AT TIME ZONE 'UTC');
$$;

DROP FUNCTION IF EXISTS public.flame_graphics_count_today();