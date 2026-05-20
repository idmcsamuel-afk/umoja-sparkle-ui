ALTER TABLE public.zcreator_content_queue
  ADD COLUMN IF NOT EXISTS generation_progress jsonb,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_zcreator_content_queue_status_updated
  ON public.zcreator_content_queue (status, updated_at);