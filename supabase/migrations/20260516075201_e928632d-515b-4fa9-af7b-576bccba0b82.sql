-- Usage tracking table
CREATE TABLE public.flame_video_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'slideshow',
  size TEXT NOT NULL,
  duration_seconds NUMERIC,
  image_count INT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flame_video_usage_member_week ON public.flame_video_usage (member_id, created_at DESC);

ALTER TABLE public.flame_video_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their own video usage"
ON public.flame_video_usage FOR SELECT TO authenticated
USING (auth.uid() = member_id);

CREATE POLICY "Members insert their own video usage"
ON public.flame_video_usage FOR INSERT TO authenticated
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Admins view all video usage"
ON public.flame_video_usage FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Weekly count RPC (week starts Monday UTC)
CREATE OR REPLACE FUNCTION public.flame_video_count_week()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.flame_video_usage
  WHERE member_id = auth.uid()
    AND created_at >= date_trunc('week', now() AT TIME ZONE 'UTC');
$$;

-- Storage bucket for finished videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('flame-videos', 'flame-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Flame videos publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'flame-videos');

CREATE POLICY "Members upload their own flame videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'flame-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Members update their own flame videos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'flame-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Members delete their own flame videos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'flame-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);