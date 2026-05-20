
DO $$ BEGIN
  CREATE TYPE public.zcreator_job_status AS ENUM ('queued','processing','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.zcreator_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.zcreator_content_queue(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.zcreator_job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 0,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS zcreator_job_queue_pick_idx
  ON public.zcreator_job_queue (status, priority DESC, queued_at ASC);
CREATE INDEX IF NOT EXISTS zcreator_job_queue_user_idx
  ON public.zcreator_job_queue (user_id, status);
CREATE INDEX IF NOT EXISTS zcreator_job_queue_content_idx
  ON public.zcreator_job_queue (content_id);

ALTER TABLE public.zcreator_job_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own jobs" ON public.zcreator_job_queue;
CREATE POLICY "users view own jobs" ON public.zcreator_job_queue
  FOR SELECT USING (auth.uid() = user_id);
