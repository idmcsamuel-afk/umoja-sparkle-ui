ALTER TABLE public.ai_generated_videos
  ADD COLUMN IF NOT EXISTS caption_instagram text,
  ADD COLUMN IF NOT EXISTS caption_tiktok text,
  ADD COLUMN IF NOT EXISTS caption_facebook text,
  ADD COLUMN IF NOT EXISTS hashtags text;