
CREATE TABLE public.member_video_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.ai_generated_videos(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'unknown',
  caption_used text,
  views_tracked integer NOT NULL DEFAULT 0,
  referrals_generated integer NOT NULL DEFAULT 0,
  shared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_video_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mvs_member ON public.member_video_shares(member_id, shared_at DESC);
CREATE INDEX idx_mvs_video ON public.member_video_shares(video_id);

CREATE POLICY "Members view own shares"
  ON public.member_video_shares FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin(auth.uid()));

CREATE POLICY "Members insert own shares"
  ON public.member_video_shares FOR INSERT
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Admins manage shares"
  ON public.member_video_shares FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow members to read ready admin-generated videos for browsing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_generated_videos'
      AND policyname='Members can view ready videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Members can view ready videos" ON public.ai_generated_videos FOR SELECT USING (generation_status = ''ready'' OR public.is_admin(auth.uid()))';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_avatars'
      AND policyname='Anyone authed can view avatars'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone authed can view avatars" ON public.ai_avatars FOR SELECT USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;
