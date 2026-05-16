CREATE TABLE public.flame_graphics_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  template TEXT NOT NULL,
  size TEXT NOT NULL,
  style TEXT,
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flame_graphics_usage_member_day ON public.flame_graphics_usage (member_id, created_at DESC);

ALTER TABLE public.flame_graphics_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own graphics usage"
ON public.flame_graphics_usage FOR SELECT
TO authenticated
USING (auth.uid() = member_id);

CREATE POLICY "Members can insert their own graphics usage"
ON public.flame_graphics_usage FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Admins can view all graphics usage"
ON public.flame_graphics_usage FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.flame_graphics_count_today()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.flame_graphics_usage
  WHERE member_id = auth.uid()
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
$$;