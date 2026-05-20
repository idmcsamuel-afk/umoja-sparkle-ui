
-- 1. story agents
CREATE TABLE public.zcreator_story_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  niche text,
  brand_voice jsonb DEFAULT '{}'::jsonb,
  content_frequency text,
  platforms text[] DEFAULT '{}',
  auto_generate boolean NOT NULL DEFAULT false,
  auto_publish boolean NOT NULL DEFAULT false,
  performance_score numeric NOT NULL DEFAULT 0,
  videos_created integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zcreator_story_agents ENABLE ROW LEVEL SECURITY;

-- 2. video styles
CREATE TABLE public.zcreator_video_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  cost_rands numeric NOT NULL DEFAULT 0,
  generation_time_minutes integer,
  quality_tier text,
  sample_video_url text,
  available boolean NOT NULL DEFAULT true
);
ALTER TABLE public.zcreator_video_styles ENABLE ROW LEVEL SECURITY;

-- 3. content queue
CREATE TABLE public.zcreator_content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.zcreator_story_agents(id) ON DELETE SET NULL,
  script_title text,
  script_content text,
  video_style text,
  status text NOT NULL DEFAULT 'script_ready',
  video_url text,
  thumbnail_url text,
  captions_url text,
  duration_seconds integer,
  platforms text[] DEFAULT '{}',
  platform_metadata jsonb DEFAULT '{}'::jsonb,
  scheduled_publish_at timestamptz,
  actual_published_at timestamptz,
  generation_cost_rands numeric DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zcreator_content_queue ENABLE ROW LEVEL SECURITY;

-- 4. published content
CREATE TABLE public.zcreator_published_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.zcreator_content_queue(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_video_id text,
  platform_url text,
  published_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zcreator_published_content ENABLE ROW LEVEL SECURITY;

-- 5. analytics
CREATE TABLE public.zcreator_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.zcreator_content_queue(id) ON DELETE CASCADE,
  platform text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  watch_time_minutes integer NOT NULL DEFAULT 0,
  estimated_revenue_rands numeric NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zcreator_analytics ENABLE ROW LEVEL SECURITY;

-- 6. subscriptions
CREATE TABLE public.zcreator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  videos_per_month integer,
  platforms_enabled text[] DEFAULT '{}',
  auto_publish_enabled boolean NOT NULL DEFAULT false,
  white_label_enabled boolean NOT NULL DEFAULT false,
  monthly_cost_sparks integer,
  monthly_cost_rands numeric,
  videos_used_this_month integer NOT NULL DEFAULT 0,
  billing_cycle_starts_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zcreator_subscriptions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_zc_agents_user ON public.zcreator_story_agents(user_id);
CREATE INDEX idx_zc_queue_user ON public.zcreator_content_queue(user_id);
CREATE INDEX idx_zc_queue_agent ON public.zcreator_content_queue(agent_id);
CREATE INDEX idx_zc_pub_content ON public.zcreator_published_content(content_id);
CREATE INDEX idx_zc_analytics_content ON public.zcreator_analytics(content_id);

-- updated_at triggers (reuse existing touch_updated_at)
CREATE TRIGGER trg_zc_agents_touch BEFORE UPDATE ON public.zcreator_story_agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_zc_queue_touch BEFORE UPDATE ON public.zcreator_content_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS policies: story agents
CREATE POLICY "zc_agents_own_select" ON public.zcreator_story_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "zc_agents_own_insert" ON public.zcreator_story_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "zc_agents_own_update" ON public.zcreator_story_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "zc_agents_own_delete" ON public.zcreator_story_agents FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "zc_agents_admin_all" ON public.zcreator_story_agents FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: video styles (public read, admin manage)
CREATE POLICY "zc_styles_public_select" ON public.zcreator_video_styles FOR SELECT USING (true);
CREATE POLICY "zc_styles_admin_all" ON public.zcreator_video_styles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: content queue
CREATE POLICY "zc_queue_own_select" ON public.zcreator_content_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "zc_queue_own_insert" ON public.zcreator_content_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "zc_queue_own_update" ON public.zcreator_content_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "zc_queue_own_delete" ON public.zcreator_content_queue FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "zc_queue_admin_all" ON public.zcreator_content_queue FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: published content (tied to user via content_queue)
CREATE POLICY "zc_pub_own_select" ON public.zcreator_published_content FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.zcreator_content_queue q WHERE q.id = content_id AND q.user_id = auth.uid())
);
CREATE POLICY "zc_pub_own_insert" ON public.zcreator_published_content FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.zcreator_content_queue q WHERE q.id = content_id AND q.user_id = auth.uid())
);
CREATE POLICY "zc_pub_own_delete" ON public.zcreator_published_content FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.zcreator_content_queue q WHERE q.id = content_id AND q.user_id = auth.uid())
);
CREATE POLICY "zc_pub_admin_all" ON public.zcreator_published_content FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: analytics
CREATE POLICY "zc_analytics_own_select" ON public.zcreator_analytics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.zcreator_content_queue q WHERE q.id = content_id AND q.user_id = auth.uid())
);
CREATE POLICY "zc_analytics_admin_all" ON public.zcreator_analytics FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: subscriptions
CREATE POLICY "zc_subs_own_select" ON public.zcreator_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "zc_subs_own_insert" ON public.zcreator_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "zc_subs_own_update" ON public.zcreator_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "zc_subs_admin_all" ON public.zcreator_subscriptions FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed default video styles
INSERT INTO public.zcreator_video_styles (style_code, display_name, description, cost_rands, generation_time_minutes, quality_tier) VALUES
  ('talking_head', 'AI Avatar (HeyGen)', 'Realistic AI avatar talking-head videos', 2, 3, 'standard'),
  ('cinematic', 'Cinematic (Kling AI)', 'High-quality cinematic AI-generated video', 5, 8, 'premium'),
  ('stock', 'Stock Footage Assembly', 'Curated stock footage assembled to script', 0, 5, 'basic'),
  ('animation', 'Animated (ComfyUI)', 'AI-generated animated videos', 0, 15, 'standard');
