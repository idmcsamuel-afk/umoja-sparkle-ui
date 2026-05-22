
-- Podcast episodes table
CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  audio_url text,
  cover_image_url text,
  duration_seconds integer DEFAULT 0,
  episode_number integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  timestamps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  takeaways text[] NOT NULL DEFAULT '{}',
  related_links_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  play_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "podcast_episodes_public_read" ON public.podcast_episodes;
CREATE POLICY "podcast_episodes_public_read" ON public.podcast_episodes
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "podcast_episodes_admin_insert" ON public.podcast_episodes;
CREATE POLICY "podcast_episodes_admin_insert" ON public.podcast_episodes
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "podcast_episodes_admin_update" ON public.podcast_episodes;
CREATE POLICY "podcast_episodes_admin_update" ON public.podcast_episodes
  FOR UPDATE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "podcast_episodes_admin_delete" ON public.podcast_episodes;
CREATE POLICY "podcast_episodes_admin_delete" ON public.podcast_episodes
  FOR DELETE USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_podcast_episodes_touch ON public.podcast_episodes;
CREATE TRIGGER trg_podcast_episodes_touch
  BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Podcast analytics table
CREATE TABLE IF NOT EXISTS public.podcast_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('play','pause','seek','complete')),
  seconds_listened numeric DEFAULT 0,
  percentage_completed numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "podcast_analytics_insert_any" ON public.podcast_analytics;
CREATE POLICY "podcast_analytics_insert_any" ON public.podcast_analytics
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "podcast_analytics_admin_read" ON public.podcast_analytics;
CREATE POLICY "podcast_analytics_admin_read" ON public.podcast_analytics
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Atomic play count increment
CREATE OR REPLACE FUNCTION public.increment_podcast_play(_episode uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.podcast_episodes SET play_count = play_count + 1 WHERE id = _episode;
$$;

-- Storage buckets (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('podcast-episodes','podcast-episodes', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('podcast-covers','podcast-covers', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: public read, admin write
DROP POLICY IF EXISTS "podcast_episodes_public_read_obj" ON storage.objects;
CREATE POLICY "podcast_episodes_public_read_obj" ON storage.objects
  FOR SELECT USING (bucket_id IN ('podcast-episodes','podcast-covers'));

DROP POLICY IF EXISTS "podcast_admin_insert_obj" ON storage.objects;
CREATE POLICY "podcast_admin_insert_obj" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('podcast-episodes','podcast-covers') AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "podcast_admin_update_obj" ON storage.objects;
CREATE POLICY "podcast_admin_update_obj" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('podcast-episodes','podcast-covers') AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "podcast_admin_delete_obj" ON storage.objects;
CREATE POLICY "podcast_admin_delete_obj" ON storage.objects
  FOR DELETE USING (bucket_id IN ('podcast-episodes','podcast-covers') AND public.is_admin(auth.uid()));
