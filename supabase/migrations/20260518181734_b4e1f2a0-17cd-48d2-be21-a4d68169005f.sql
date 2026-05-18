
-- Campaigns
CREATE TABLE public.ai_content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  target_videos_per_day integer NOT NULL DEFAULT 10,
  target_posts_per_day integer NOT NULL DEFAULT 5,
  platforms jsonb NOT NULL DEFAULT '["instagram","tiktok","facebook"]'::jsonb,
  autonomous_settings jsonb NOT NULL DEFAULT '{"auto_scripts":true,"auto_videos":true,"auto_schedule":true,"auto_pause_low":true,"auto_boost_high":true,"target_queue_min":100,"target_queue_max":150}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  heygen_avatar_id text,
  persona_description text,
  voice_id text,
  preview_image_url text,
  performance_score numeric(5,2) NOT NULL DEFAULT 0,
  times_used integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  member_selectable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_generated_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.ai_content_campaigns(id) ON DELETE SET NULL,
  script_type text,
  script_text text NOT NULL,
  hook text,
  persona_index integer,
  generated_by text NOT NULL DEFAULT 'claude',
  performance_score numeric(5,2),
  used_count integer NOT NULL DEFAULT 0,
  member_template boolean NOT NULL DEFAULT false,
  template_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_generated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.ai_content_campaigns(id) ON DELETE SET NULL,
  avatar_id uuid REFERENCES public.ai_avatars(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.ai_generated_scripts(id) ON DELETE SET NULL,
  heygen_video_id text,
  video_url text,
  thumbnail_url text,
  video_title text,
  video_caption text,
  duration_seconds integer,
  generation_status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.ai_generated_videos(id) ON DELETE CASCADE,
  platform text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  posted_at timestamptz,
  post_status text NOT NULL DEFAULT 'scheduled',
  post_url text,
  error_message text,
  engagement_metrics jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_posts_time ON public.ai_scheduled_posts(scheduled_for, post_status);
CREATE INDEX idx_generated_videos_status ON public.ai_generated_videos(generation_status);

-- Member-generated videos
CREATE TABLE public.member_generated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  script_id uuid REFERENCES public.ai_generated_scripts(id) ON DELETE SET NULL,
  avatar_id uuid REFERENCES public.ai_avatars(id) ON DELETE SET NULL,
  script_text text NOT NULL,
  heygen_video_id text,
  video_url text,
  thumbnail_url text,
  caption text,
  referral_code text,
  referral_link text,
  generation_status text NOT NULL DEFAULT 'pending',
  error_message text,
  share_count integer NOT NULL DEFAULT 0,
  download_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  signups_attributed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_videos_member ON public.member_generated_videos(member_id);
CREATE INDEX idx_member_videos_status ON public.member_generated_videos(generation_status);

-- Triggers (updated_at)
CREATE TRIGGER tg_ai_campaigns_touch BEFORE UPDATE ON public.ai_content_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_ai_avatars_touch BEFORE UPDATE ON public.ai_avatars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_ai_videos_touch BEFORE UPDATE ON public.ai_generated_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_member_videos_touch BEFORE UPDATE ON public.member_generated_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.ai_content_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_generated_videos ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for admin tables
CREATE POLICY admin_all_campaigns ON public.ai_content_campaigns FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY admin_all_avatars ON public.ai_avatars FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
-- Members may read active, member_selectable avatars for the wizard
CREATE POLICY member_read_avatars ON public.ai_avatars FOR SELECT TO authenticated
  USING (is_active = true AND member_selectable = true);

CREATE POLICY admin_all_scripts ON public.ai_generated_scripts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
-- Members may read scripts flagged as templates
CREATE POLICY member_read_script_templates ON public.ai_generated_scripts FOR SELECT TO authenticated
  USING (member_template = true);

CREATE POLICY admin_all_videos ON public.ai_generated_videos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY admin_all_scheduled ON public.ai_scheduled_posts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Member videos: owner CRUD, admins all, public read for share landing
CREATE POLICY member_videos_own_select ON public.member_generated_videos FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY member_videos_own_insert ON public.member_generated_videos FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());
CREATE POLICY member_videos_own_update ON public.member_generated_videos FOR UPDATE TO authenticated
  USING (member_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY member_videos_admin_delete ON public.member_generated_videos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY member_videos_public_read_ready ON public.member_generated_videos FOR SELECT TO anon
  USING (generation_status = 'ready');

-- Leaderboard helper (top member video creators)
CREATE OR REPLACE FUNCTION public.member_video_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(member_id uuid, full_name text, videos_count bigint, total_shares bigint, total_signups bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.member_id,
         COALESCE(m.full_name,'Member') AS full_name,
         COUNT(*)::bigint AS videos_count,
         COALESCE(SUM(v.share_count),0)::bigint AS total_shares,
         COALESCE(SUM(v.signups_attributed),0)::bigint AS total_signups
    FROM public.member_generated_videos v
    LEFT JOIN public.members m ON m.id = v.member_id
   WHERE v.generation_status = 'ready'
   GROUP BY v.member_id, m.full_name
   ORDER BY total_shares DESC, videos_count DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

-- Increment helpers (used by client)
CREATE OR REPLACE FUNCTION public.bump_member_video_metric(_id uuid, _metric text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _metric NOT IN ('share','download','view') THEN
    RAISE EXCEPTION 'invalid metric';
  END IF;
  IF _metric = 'share' THEN
    UPDATE public.member_generated_videos SET share_count = share_count + 1 WHERE id = _id;
  ELSIF _metric = 'download' THEN
    UPDATE public.member_generated_videos SET download_count = download_count + 1 WHERE id = _id;
  ELSE
    UPDATE public.member_generated_videos SET view_count = view_count + 1 WHERE id = _id;
  END IF;
END $$;
