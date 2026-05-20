CREATE TABLE IF NOT EXISTS public.zcreator_youtube_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  channel_id text,
  channel_title text,
  default_privacy text NOT NULL DEFAULT 'unlisted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zcreator_youtube_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt tokens owner select" ON public.zcreator_youtube_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "yt tokens owner insert" ON public.zcreator_youtube_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "yt tokens owner update" ON public.zcreator_youtube_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "yt tokens owner delete" ON public.zcreator_youtube_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_yt_tokens_updated_at
  BEFORE UPDATE ON public.zcreator_youtube_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();